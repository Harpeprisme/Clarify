/**
 * Format Router
 * =============
 * Detects the file format from extension + magic bytes,
 * then dispatches to the appropriate parser.
 *
 * All parsers return the same normalized shape:
 *   [{ date: ISO string, description: string, amount: number, type: 'INCOME'|'EXPENSE' }]
 */

const path = require('path');
const { parseCSV, detectFormat: detectCSVFormat } = require('./csvParser');
const { parseExcel } = require('./excelParser');
const { parseOFX }   = require('./ofxParser');
const { parseQIF }   = require('./qifParser');
// pdfParser is lazy-loaded below to avoid canvas GC handle during tests

// ── Magic byte detection ────────────────────────────────────────────────────

/**
 * Detect file type from buffer magic bytes (file signature).
 * @param {Buffer} buffer
 * @returns {'xlsx'|'pdf'|'ofx'|'text'|'unknown'}
 */
function detectMagicType(buffer) {
  if (buffer.length < 4) return 'unknown';

  // XLSX / ZIP (starts with PK\x03\x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'xlsx';
  }

  // XLS (starts with D0 CF 11 E0)
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return 'xls';
  }

  // PDF (%PDF-)
  if (buffer.slice(0, 5).toString('ascii') === '%PDF-') {
    return 'pdf';
  }

  // OFX/QFX — check for OFXHEADER or <OFX> tag
  const start = buffer.slice(0, 200).toString('utf-8');
  if (start.includes('OFXHEADER') || start.includes('<OFX>') || start.includes('<ofx>')) {
    return 'ofx';
  }

  // QIF — starts with !Type:
  if (start.trim().startsWith('!Type:') || start.trim().startsWith('!type:')) {
    return 'qif';
  }

  return 'text'; // Assume CSV/text
}

/**
 * Detect the actual format type from filename + buffer.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {'csv'|'xlsx'|'xls'|'ofx'|'qfx'|'qif'|'pdf'}
 */
function detectFileFormat(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase().replace('.', '');

  // Extension takes priority for text-based formats
  const extMap = {
    csv: 'csv', txt: 'csv', tsv: 'csv',
    xlsx: 'xlsx', xls: 'xls',
    ofx: 'ofx', qfx: 'ofx',
    qif: 'qif',
    pdf: 'pdf',
  };

  if (extMap[ext]) return extMap[ext];

  // Fallback: magic bytes
  const magic = detectMagicType(buffer);
  if (magic !== 'unknown') return magic;

  return 'csv'; // Final fallback
}

/**
 * Parse any supported bank statement file.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<Array<{date, description, amount, type}>>}
 */
async function parseAnyFile(buffer, filename) {
  const format = detectFileFormat(buffer, filename);

  switch (format) {
    case 'xlsx':
    case 'xls':
      return parseExcel(buffer);

    case 'ofx':
      return parseOFX(buffer);

    case 'qif':
      return parseQIF(buffer);

    case 'pdf':
      return require('./pdfParser').parsePDF(buffer);

    case 'csv':
    default:
      return parseCSV(buffer);
  }
}

/**
 * Extended detectFormat for the /detect endpoint.
 * Returns format-specific metadata for the UI preview panel.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<Object>}
 */
async function detectFormat(buffer, filename) {
  const fileType = detectFileFormat(buffer, filename);

  switch (fileType) {
    case 'xlsx':
    case 'xls': {
      const XLSX = require('xlsx');
      const wb = XLSX.read(buffer, { type: 'buffer', sheetRows: 5 });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        fileType: 'Excel',
        sheetName,
        columns,
        sampleRows: rows.slice(0, 3),
        estimatedRows: rows.length,
      };
    }

    case 'ofx': {
      return {
        fileType: 'OFX/QFX',
        description: 'Fichier Open Financial Exchange (standard bancaire international)',
        sampleRows: [],
        columns: ['Date', 'Description', 'Montant'],
      };
    }

    case 'qif': {
      return {
        fileType: 'QIF (Quicken)',
        description: 'Fichier Quicken Interchange Format',
        sampleRows: [],
        columns: ['Date', 'Payee/Description', 'Montant'],
      };
    }

    case 'pdf': {
      const pdfParse = require('pdf-parse');
      try {
        const data = await pdfParse(buffer, { max: 1 });
        const hasText = (data.text || '').length > 100;
        return {
          fileType: 'PDF',
          pageCount: data.numpages,
          hasNativeText: hasText,
          ocrRequired: !hasText,
          description: hasText
            ? `PDF texte — ${data.numpages} page(s), extraction directe`
            : `PDF scanné — ${data.numpages} page(s), OCR automatique sera utilisé`,
          sampleRows: [],
          columns: ['Date', 'Description', 'Montant'],
        };
      } catch {
        return { fileType: 'PDF', description: 'PDF détecté', sampleRows: [], columns: [] };
      }
    }

    default:
      // CSV: use the existing detailed detection
      return detectCSVFormat(buffer);
  }
}

module.exports = { parseAnyFile, detectFormat, detectFileFormat };
