/**
 * PDF Parser — powered by pdfjs-dist
 * ====================================
 * Extracts text from PDF bank statements by reconstructing lines
 * from X/Y coordinates (via pdfjs-dist dynamic import).
 *
 * Real-world Bank PDF text is often compressed: PDF items may be
 * individual characters or words with no spacing between them.
 * Line reconstruction groups items sharing the same Y coordinate.
 *
 * Supported formats:
 *  - Hello Bank / BNP:  "20.02FACTURE(S)CARTE...23.022,70"
 *  - CA Livret A:       "19.0201.03VirementDe M.Abergel1 110,00¨"
 *  - Generic European:  "DD/MM/YYYY  DESCRIPTION  AMOUNT"
 */

const { parseDate, parseAmount } = require('./parserUtils');

// ── Skip patterns (headers, page numbers, totals) ────────────────────────────
const SKIP_PATTERNS = [
  /ancien\s*solde/i,
  /nouveau\s*solde/i,
  /report\s*(du|nouveau|au)/i,
  /total\s*(des\s*op|mouvements)/i,
  /^\s*p\.\s*\d+/i,
  /releve\s*de\s*compte/i,
  /^rib\s*:/i,
  /votre\s*(agence|conseiller)/i,
  /^synthes[ei]/i,
  /date\s*nature\s*des\s*op/i,
  /datedate/i,
  /libell.+d.bit/i,
  /caisse\s*r.gionale/i,
  /garantiedesdepots/i,
  /^page\s*\d/i,
];

// ── Transaction line patterns (compact, no guaranteed spaces) ─────────────────
//
// Pattern A — "DD.MMDescriptionDD.MMAMOUNT" (Hello Bank dominant format)
// The "value date" DD.MM appears just before the amount. We capture:
//   start: DD.MM
//   desc:  everything up to the last DD.MM before the amount
//   amount: French number at the end
//
// We use a greedy+lazy combo to find the rightmost occurrence of the value date.
const PATTERN_COMPACT_DATE =
  /^(\d{2})\.(\d{2})(.+?)(?:\d{2}\.\d{2})?(\d[\d\s]*[,.]\d{2})[¨u]?\s*$/;

// Pattern B — "DD.MMDD.MMDescriptionAMOUNT" (CA Livret A)
const PATTERN_LIVRET =
  /^(\d{2})\.(\d{2})\d{2}\.\d{2}(.+?)(\d[\d\s]*[,.]\d{2})[¨u]?\s*$/;

// Pattern C — purely numeric date line: "DD.MM DD.MM AMOUNT" (continuation)
// (e.g.  "23.02 23.02 25,45")
const PATTERN_DATE_DATE_AMOUNT =
  /^(\d{2})\.(\d{2})\s*\d{2}\.\d{2}\s*(\d[\d\s]*[,.]\d{2})\s*$/;

// Pattern D — ISO / slash date at start
const PATTERN_SLASH_DATE =
  /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.{2,}?)\s+([+-]?\d[\d\s]*[,.]\d{2})\s*$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect the year from context lines (look for "20XX").
 */
function detectYear(lines) {
  for (const line of lines.slice(0, 30)) {
    const m = [...line.matchAll(/\b(20\d{2})\b/g)];
    if (m.length) return parseInt(m[m.length - 1][1]);
  }
  return new Date().getFullYear();
}

/**
 * Determine sign of amount:
 * - If line ends with "¨" or "u" → credit (money in)
 * - If description contains credit keywords → credit
 * - Default → debit (money out, negative)
 */
function resolveSign(rawLine, description, rawAmount) {
  const amount = parseAmount(rawAmount.replace(/\s/g, ''));
  if (amount === null || amount === 0) return null;

  if (/[¨]\s*$/.test(rawLine)) return Math.abs(amount);

  if (/vir.{0,10}re.u|rem\s*chq|remise|salaire|allocation|remboursement/i.test(description)) {
    return Math.abs(amount);
  }

  return -Math.abs(amount);
}

/**
 * Try to reconstruct a readable description from a compact no-space string.
 * Inserts spaces before uppercase letters that follow lowercase/digits
 * and before common banking keywords.
 */
function cleanDesc(raw) {
  return raw
    // space before date patterns embedded in desc
    .replace(/(\d{2}\.\d{2})([A-Z])/g, '$1 $2')
    // space between consecutive uppercase sequences and lowercase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // collapse runs of spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// ── PDF text extraction ───────────────────────────────────────────────────────

async function loadPdfjs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

/**
 * Extract all lines from a PDF buffer, reconstructed from XY item coordinates.
 */
async function extractLines(buffer) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const byY = new Map();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: item.transform[4], text: item.str });
    }

    const sortedYs = [...byY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      // Join items WITHOUT artificial spaces (respect the original PDF layout)
      const joined = byY.get(y)
        .sort((a, b) => a.x - b.x)
        .map(i => i.text)
        .join('')
        .trim();
      if (joined && joined.length >= 4) allLines.push(joined);
    }
  }

  return allLines;
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a PDF buffer into normalized transaction rows.
 */
async function parsePDF(buffer) {
  const lines = await extractLines(buffer);

  if (!lines.length) {
    throw new Error(
      'Ce PDF ne contient pas de texte extractible. ' +
      'Seuls les PDFs texte sont supportés (pas les scans images).'
    );
  }

  const year = detectYear(lines);
  const results = [];

  // Track the last matched description for "continuation lines" (multi-line transactions)
  let lastDesc = null;

  for (const line of lines) {
    if (SKIP_PATTERNS.some(re => re.test(line))) { lastDesc = null; continue; }

    // ── Try Pattern B (Livret A: two dates + desc + amount) ──
    let m = line.match(PATTERN_LIVRET);
    if (m) {
      const [, day, month, rawDesc, rawAmount] = m;
      const date = parseDate(`${day.padStart(2,'0')}/${month.padStart(2,'0')}/${year}`);
      if (date) {
        const description = cleanDesc(rawDesc);
        const amount = resolveSign(line, description, rawAmount);
        if (amount !== null) {
          results.push({ date, description, amount, type: amount >= 0 ? 'INCOME' : 'EXPENSE' });
          lastDesc = description;
          continue;
        }
      }
    }

    // ── Try Pattern A (compact: date + desc + optional value-date + amount) ──
    m = line.match(PATTERN_COMPACT_DATE);
    if (m) {
      const [full, day, month, rawDesc, rawAmount] = m;
      // Sanity check: description shouldn't be just whitespace
      const descClean = cleanDesc(rawDesc.replace(/\d{2}\.\d{2}\s*$/, ''));
      if (descClean.length >= 2) {
        const date = parseDate(`${day.padStart(2,'0')}/${month.padStart(2,'0')}/${year}`);
        if (date) {
          const amount = resolveSign(line, descClean, rawAmount);
          if (amount !== null) {
            results.push({ date, description: descClean, amount, type: amount >= 0 ? 'INCOME' : 'EXPENSE' });
            lastDesc = descClean;
            continue;
          }
        }
      }
    }

    // ── Try Pattern C (date date amount — credit/debit continuation) ──
    m = line.match(PATTERN_DATE_DATE_AMOUNT);
    if (m && lastDesc) {
      const [full, day, month, rawAmount] = m;
      const date = parseDate(`${day.padStart(2,'0')}/${month.padStart(2,'0')}/${year}`);
      if (date) {
        const amount = resolveSign(line, lastDesc, rawAmount);
        if (amount !== null) {
          results.push({ date, description: lastDesc, amount, type: amount >= 0 ? 'INCOME' : 'EXPENSE' });
          continue;
        }
      }
    }

    // ── Try Pattern D (slash/standard date format) ──
    m = line.match(PATTERN_SLASH_DATE);
    if (m) {
      const [, rawDate, rawDesc, rawAmount] = m;
      const date = parseDate(rawDate);
      if (date) {
        const description = cleanDesc(rawDesc);
        const amount = resolveSign(line, description, rawAmount);
        if (amount !== null) {
          results.push({ date, description, amount, type: amount >= 0 ? 'INCOME' : 'EXPENSE' });
          lastDesc = description;
          continue;
        }
      }
    }

    // Not a transaction line — reset continuation context only for header-like lines
    if (/^[A-Z\s]{5,}$/.test(line)) lastDesc = null;
  }

  if (results.length === 0) {
    throw new Error(
      `Aucune transaction détectée dans ce PDF (${lines.length} lignes analysées). ` +
      'Vérifiez que le fichier est bien un relevé bancaire avec colonnes Date/Description/Montant.'
    );
  }

  return results;
}

module.exports = { parsePDF };
