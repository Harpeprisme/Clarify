/**
 * PDF Parser — with OCR Fallback
 * =================================
 * Pass 1: Extract native text via pdf-parse (fast, for digital PDFs).
 * Pass 2: If text is insufficient, use Tesseract.js OCR on each page
 *         converted to PNG via pdf2pic (handles scanned PDFs).
 *
 * Output: same normalized { date, description, amount, type } rows as all other parsers.
 */

const pdfParse  = require('pdf-parse');
const { parseDate, parseAmount } = require('./parserUtils');

// ── Regex patterns to extract transaction lines from plain text ───────────────
//
// Most bank statement PDFs follow a pattern on each line:
//   DATE  DESCRIPTION  AMOUNT
//
// These regexes cover common French/European bank PDF layouts.
const TX_LINE_REGEXES = [
  // "25/12/2023  Virement reçu  +1 200,00"
  /(?<date>\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(?<desc>.{5,80}?)\s+(?<amount>[+-]?\s*[\d\s]+[,.]\d{2})\s*$/,
  // "2023-12-25  Carrefour  -42,50"
  /(?<date>\d{4}[\/\-.]\d{2}[\/\-.]\d{2})\s+(?<desc>.{5,80}?)\s+(?<amount>[+-]?\s*[\d\s]+[,.]\d{2})\s*$/,
];

/**
 * Try to extract transaction lines from plain text extracted from a PDF.
 */
function extractFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    for (const re of TX_LINE_REGEXES) {
      const m = line.match(re);
      if (m && m.groups) {
        const date   = parseDate(m.groups.date.trim());
        const amount = parseAmount(m.groups.amount.replace(/\s/g, ''));
        const description = m.groups.desc.replace(/\s+/g, ' ').trim();
        if (date && amount !== null) {
          results.push({ date, description, amount, type: amount >= 0 ? 'INCOME' : 'EXPENSE' });
          break; // stop trying regexes for this line
        }
      }
    }
  }

  return results;
}

/**
 * OCR fallback: convert each PDF page to image, then run Tesseract.
 * Returns raw text for all pages combined.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function ocrPdf(buffer) {
  let Tesseract, pdf2pic;

  try {
    Tesseract = require('tesseract.js');
    const { fromBuffer } = require('pdf2pic');

    const convert = fromBuffer(buffer, {
      density:    200,    // DPI — higher = better quality, but slower
      format:     'png',
      width:      1700,
      height:     2200,
    });

    // Get number of pages
    const meta = await pdfParse(buffer, { max: 0 });
    const pageCount = Math.min(meta.numpages || 1, 20); // cap at 20 pages

    let fullText = '';

    for (let i = 1; i <= pageCount; i++) {
      try {
        const pageResult = await convert(i, { responseType: 'buffer' });
        const imageBuffer = pageResult.buffer;

        const { data } = await Tesseract.recognize(imageBuffer, 'fra+eng', {
          logger: () => {},  // silence progress logs
        });

        fullText += data.text + '\n';
      } catch (pageErr) {
        // Skip pages that fail to convert or recognize
      }
    }

    return fullText;

  } catch (err) {
    throw new Error(`OCR failed: ${err.message}. Assurez-vous que pdf2pic et tesseract.js sont installés.`);
  }
}

/**
 * Parse a PDF buffer into normalized transaction rows.
 * Pass 1: Native text extraction.
 * Pass 2: OCR fallback for scanned PDFs.
 *
 * @param {Buffer} buffer
 * @returns {Promise<Array<{date, description, amount, type}>>}
 */
async function parsePDF(buffer) {
  // ── Pass 1: Native text ────────────────────────────────────────────────────
  let nativeData;
  try {
    nativeData = await pdfParse(buffer);
  } catch (err) {
    throw new Error(`Impossible de lire le PDF : ${err.message}`);
  }

  const nativeText = nativeData.text || '';
  // Heuristic: sufficient text if > 80 chars per page on average
  const avgCharsPerPage = nativeText.length / Math.max(nativeData.numpages || 1, 1);

  if (avgCharsPerPage >= 80) {
    const rows = extractFromText(nativeText);
    if (rows.length > 0) return rows;
    // Text extracted but no transactions found with regex — try OCR anyway
  }

  // ── Pass 2: OCR fallback ───────────────────────────────────────────────────
  const ocrText = await ocrPdf(buffer);
  const rows = extractFromText(ocrText);

  if (rows.length === 0) {
    throw new Error(
      'Aucune transaction détectée dans ce PDF. ' +
      'Si c\'est un relevé scanné en image, vérifiez que la résolution du scan est correcte (>150 DPI).'
    );
  }

  return rows;
}

module.exports = { parsePDF };
