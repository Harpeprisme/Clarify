/**
 * Universal CSV Bank Statement Parser
 * ====================================
 * Supports most French/European bank CSV formats automatically:
 *  - Crédit Agricole, BNP Paribas, Société Générale, Boursorama/Boursobank,
 *    LCL, La Banque Postale, Fortuneo, Hello Bank, ING, N26, Revolut, Wise, etc.
 *
 * Auto-detects:
 *  - File encoding (UTF-8, UTF-8 BOM, Latin-1/ISO-8859-1, Windows-1252)
 *  - Delimiter (`;`, `,`, `\t`)
 *  - Metadata header rows before the actual data
 *  - Date column and date format
 *  - Amount format: single column OR separate Debit/Credit columns
 *  - French number format (spaces as thousands separator, comma as decimal)
 */

const Papa = require('papaparse');
const { parse, isValid } = require('date-fns');

// ─────────────────────────────────────────────
// Known column name patterns per semantic role
// ─────────────────────────────────────────────
const COLUMN_PATTERNS = {
  date: [
    /^date$/,
    /^date op/,            // "Date opération", "Date op."
    /^date d.op/,          // "Date d'opération"
    /^date de (l.op|val|compt)/,
    /^date (valeur|comptable)/,
    /^date d.ex/,          // "Date d'exécution" (brokerage)
  ],
  description: [
    /libell/,              // "Libellé", "Libellé opération"
    /description/,
    /motif/,
    /d.tails/,             // "Détails"
    /label/,
    /^op.ration$/,         // "Opération" (Fortuneo: type d'opération)
    /r.f.rence/,           // "Référence"
    /communication/,
    /objet/,
    /wording/,
    /narrative/,
    /particulars/,
    /^instrument/,         // "Instrument financier"
    /^valeur$/,            // "Valeur" (titre bourse)
    /^titre/,              // "Titre"
  ],
  debit: [
    /d.bit/,               // "Débit", "Débit euros"
    /retrait/,
    /sortie/,
    /withdrawal/,
    /^debit\b/,
    /charges/,
    /^(out|dr)\b/,
  ],
  credit: [
    /cr.dit/,              // "Crédit", "Crédit euros"
    /versement/,
    /entr.e/,              // "Entrée"
    /deposit/,
    /^credit\b/,
    /^(in|cr)\b/,
  ],
  amount: [
    // Generic
    /^montant$/,
    /^montant net$/,       // Fortuneo: "Montant net" (after fees)
    /^montant brut$/,      // Fortuneo: "Montant brut" (before fees)
    /^(montant|amount) (en |op|tot)/,
    /^sum$/,
    /transaction amount/,
    /^paid (in|out)/,
    // Brokerage-specific (use net amount, which is the real cash impact)
    /montant net/,
    /net amount/,
    /net cash/,
    /^total$/,
    /^r.gl/,               // "Règlement", "Règlement net"
  ],
  // Extra: brokerage price per unit — used as fallback if no amount column found
  unitPrice: [
    /^prix/,               // "Prix d'éxé", "Prix unitaire"
    /^cours/,              // "Cours"
    /^unit price/,
    /^price/,
  ],
  // Extra: brokerage quantity — used together with unit price
  quantity: [
    /^qt.$/,               // "Qté"
    /^quantit/,
    /^nombre/,
    /^qty/,
    /^shares/,
  ],
};

// ─────────────────────────────────────────────
// Date formats by decreasing specificity
// ─────────────────────────────────────────────
const DATE_FORMATS = [
  'dd/MM/yyyy',   // CA, BNP, SG
  'dd-MM-yyyy',
  'yyyy-MM-dd',   // ISO
  'dd/MM/yy',     // Short year
  'MM/dd/yyyy',   // US fallback
  'dd.MM.yyyy',   // German-style
  'yyyyMMdd',     // Compact
  'd/M/yyyy',     // No zero-padding
  'd MMM yyyy',   // "5 Jan 2026"
  'yyyy/MM/dd',
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Normalize a string for matching: lowercase + remove diacritics
 */
const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Find the first column key that matches any of the given regex patterns
 */
const findColumn = (keys, patterns) => {
  for (const pattern of patterns) {
    const found = keys.find(k => pattern.test(norm(k)));
    if (found) return found;
  }
  return null;
};

/**
 * Parse a date string with multiple format attempts
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const cleaned = String(dateStr).trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  for (const fmt of DATE_FORMATS) {
    const d = parse(cleaned, fmt, new Date());
    if (isValid(d) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
      return d.toISOString();
    }
  }

  // Last resort: native Date
  const d = new Date(cleaned);
  if (isValid(d) && d.getFullYear() > 1990) return d.toISOString();

  return null;
};

/**
 * Parse a European/French formatted number to float.
 * Handles: "1 000,00", "1.000,00", "1 000.50", "-200,00", "200.50"
 */
const parseAmount = (amountStr) => {
  if (!amountStr || String(amountStr).trim() === '') return 0;

  let s = String(amountStr)
    .replace(/€|\$|£|USD|EUR|GBP/gi, '')
    .replace(/\u00a0/g, '')     // non-breaking space
    .trim();

  // Detect format: if comma appears after a dot (e.g. "1.000,50") → European
  // If dot appears after comma → unusual, handle anyway
  const hasCommaDecimal = /,\d{1,2}$/.test(s);
  const hasDotDecimal = /\.\d{1,3}$/.test(s);

  if (hasCommaDecimal) {
    // European: "1 000,50" or "1.000,50"
    s = s.replace(/[\s.]/g, '').replace(',', '.');
  } else if (hasDotDecimal) {
    // May be US style "1,000.50" or simple "1000.50"
    s = s.replace(/,/g, '');
  } else {
    // No decimal or ambiguous → just strip spaces and commas
    s = s.replace(/[\s,]/g, '');
  }

  const val = parseFloat(s);
  return isNaN(val) ? 0 : val;
};

/**
 * Detect file encoding from buffer.
 * Priority: UTF-8 BOM → Latin-1 heuristic → UTF-8
 */
const decodeBuffer = (buffer) => {
  const iconv = require('iconv-lite');

  // Check for UTF-8 BOM (EF BB BF)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3).toString('utf-8');
  }

  // Check for UTF-16 LE BOM (FF FE)
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return iconv.decode(buffer.slice(2), 'utf-16le');
  }

  // Heuristic: try UTF-8, check if there are replacement chars
  const utf8 = buffer.toString('utf-8');
  const replacements = (utf8.match(/\ufffd/g) || []).length;

  if (replacements === 0) {
    // Valid UTF-8
    return utf8;
  }

  // Fallback: Latin-1 (covers ISO-8859-1 and Windows-1252)
  return iconv.decode(buffer, 'latin1');
};

/**
 * Detect the best separator by counting occurrences in data lines
 */
const detectDelimiter = (text) => {
  // Use a sample of lines (skip blank ones)
  const sampleLines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 10);
  const sample = sampleLines.join('\n');

  const counts = {
    ';': (sample.match(/;/g) || []).length,
    ',': (sample.match(/,/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  };

  // Prefer ; > \t > , (commas appear in amounts)
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[',']) return '\t';
  return ',';
};

/**
 * Find the line index where actual data headers begin.
 * Returns -1 if not found (treat entire file as data).
 */
const findHeaderLine = (lines, delimiter) => {
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const normalized = norm(lines[i]);

    // Must contain "date" or "datum" (German)
    const hasDate = normalized.includes('date') || normalized.includes('datum');
    if (!hasDate) continue;

    // Must also contain at least one amount/description/brokerage indicator
    const hasAmount =
      normalized.includes('montant') ||
      normalized.includes('amount') ||
      normalized.includes('debit') ||
      normalized.includes('credit') ||
      normalized.includes('libell') ||
      normalized.includes('description') ||
      normalized.includes('motif') ||
      normalized.includes('retrait') ||
      normalized.includes('versement') ||
      normalized.includes('valeur') ||
      normalized.includes('wording') ||
      normalized.includes('sum') ||
      // Brokerage-specific indicators (Fortuneo PEA, etc.)
      normalized.includes('operation') ||
      normalized.includes('prix') ||
      normalized.includes('cours') ||
      normalized.includes('qte') ||
      normalized.includes('quantit') ||
      normalized.includes('place') ||
      normalized.includes('devise');

    if (hasDate && hasAmount) {
      return i;
    }
  }
  return -1;
};

/**
 * Extract the file portion starting from the header line,
 * preserving quoted multiline fields intact.
 */
const extractFromHeader = (text, allLines, headerLineIdx) => {
  if (headerLineIdx <= 0) return text;

  // Find character offset by scanning through lines
  let charOffset = 0;
  for (let i = 0; i < headerLineIdx; i++) {
    const lineStart = text.indexOf(allLines[i], charOffset);
    if (lineStart === -1) break;
    charOffset = lineStart + allLines[i].length;
    // Consume line ending
    if (text[charOffset] === '\r') charOffset++;
    if (text[charOffset] === '\n') charOffset++;
  }
  return text.slice(charOffset);
};

// ─────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────

/**
 * Parse a bank CSV.
 * @param {Buffer|string} csvContent
 * @returns {Promise<Array<{date, description, amount, type}>>}
 */
const parseCSV = (csvContent) => {
  return new Promise((resolve, reject) => {
    try {
      // Step 1: Decode
      const text = Buffer.isBuffer(csvContent) ? decodeBuffer(csvContent) : csvContent;

      // Step 2: Detect delimiter
      const delimiter = detectDelimiter(text);

      // Step 3: Find header line
      const allLines = text.split(/\r?\n/);
      const headerLineIdx = findHeaderLine(allLines, delimiter);
      const dataText = extractFromHeader(text, allLines, headerLineIdx === -1 ? 0 : headerLineIdx);

      // Step 4: Parse with PapaParse
      Papa.parse(dataText, {
        header: true,
        delimiter,
        skipEmptyLines: 'greedy',
        quoteChar: '"',
        complete: (results) => {
          try {
            if (!results.data || !results.data.length) {
              return resolve([]);
            }

            // Log detected structure for debugging
            const detectedColumns = results.meta.fields || [];
            console.log('[csvParser] Delimiter:', JSON.stringify(delimiter));
            console.log('[csvParser] Columns:', detectedColumns);

            const rows = results.data.map((row, rowIndex) => {
              const keys = Object.keys(row).filter(k => k.trim() !== '');

              // Step 5: Column detection
              const dateKey      = findColumn(keys, COLUMN_PATTERNS.date);
              const descKey      = findColumn(keys, COLUMN_PATTERNS.description);
              const debitKey     = findColumn(keys, COLUMN_PATTERNS.debit);
              const creditKey    = findColumn(keys, COLUMN_PATTERNS.credit);
              const amountKey    = !debitKey && !creditKey
                ? findColumn(keys, COLUMN_PATTERNS.amount)
                : null;
              // Brokerage fallbacks
              const unitPriceKey = findColumn(keys, COLUMN_PATTERNS.unitPrice);
              const quantityKey  = findColumn(keys, COLUMN_PATTERNS.quantity);

              if (!dateKey) return null;

              // Parse date
              const rawDate = row[dateKey];
              const date = parseDate(rawDate);
              if (!date) return null;

              // Parse amount — priority: debit/credit > unified amount > qty×price
              let amount = 0;
              if (debitKey || creditKey) {
                const debit  = debitKey  ? parseAmount(row[debitKey])  : 0;
                const credit = creditKey ? parseAmount(row[creditKey]) : 0;
                amount = credit - debit;
              } else if (amountKey) {
                amount = parseAmount(row[amountKey]);
              } else if (unitPriceKey && quantityKey) {
                // Brokerage fallback: compute from Qté × Prix
                // Amount sign: the "Montant net" column in Fortuneo already carries the sign
                // but if we're here it wasn't matched — compute it
                const qty   = parseAmount(row[quantityKey]);
                const price = parseAmount(row[unitPriceKey]);
                amount = -(qty * price); // Purchases are cash-negative
              }

              // Build description — for brokerage rows, combine the operation type + libellé
              // Keys: libellé (titrename), Opération (type: Achat/Vente)
              const opKey = keys.find(k => /^op.ration$/i.test(norm(k)));
              let description = '';
              if (opKey && descKey && norm(row[opKey]) !== norm(row[descKey] || '')) {
                // "Achat Comptant – iShares MSCI World…"
                description = `${String(row[opKey]).trim()} – ${String(row[descKey]).trim()}`;
              } else if (descKey) {
                description = String(row[descKey]).trim();
              }

              if (!description && keys.length > 2) {
                description = keys
                  .filter(k => k !== dateKey && k !== debitKey && k !== creditKey && k !== amountKey)
                  .map(k => String(row[k]).trim())
                  .filter(v => v.length > 2)
                  .sort((a, b) => b.length - a.length)[0] || '';
              }

              // Clean multiline descriptions
              description = description
                .replace(/\r?\n+/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();

              if (!description) return null;

              const type = amount > 0 ? 'INCOME' : 'EXPENSE';

              return { date, description, amount, type };
            }).filter(row => row !== null);

            console.log(`[csvParser] ✅ ${rows.length} valid rows parsed`);
            resolve(rows);
          } catch (err) {
            reject(err);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Detect CSV format without actually importing.
 * Returns metadata about what was detected.
 * @param {Buffer|string} csvContent
 */
const detectFormat = (csvContent) => {
  return new Promise((resolve, reject) => {
    try {
      const text = Buffer.isBuffer(csvContent) ? decodeBuffer(csvContent) : csvContent;
      const delimiter = detectDelimiter(text);
      const allLines = text.split(/\r?\n/);
      const headerLineIdx = findHeaderLine(allLines, delimiter);
      const dataText = extractFromHeader(text, allLines, headerLineIdx === -1 ? 0 : headerLineIdx);

      Papa.parse(dataText, {
        header: true,
        delimiter,
        skipEmptyLines: 'greedy',
        preview: 5, // Only parse first 5 rows for preview
        complete: (results) => {
          const fields = results.meta.fields || [];
          const keys = fields.filter(k => k.trim() !== '');

          const detected = {
            delimiter: delimiter === '\t' ? 'tabulation' : delimiter,
            encoding: Buffer.isBuffer(csvContent)
              ? (csvContent[0] === 0xEF ? 'UTF-8 BOM' : 'Latin-1 / UTF-8')
              : 'string',
            skippedHeaderRows: headerLineIdx === -1 ? 0 : headerLineIdx,
            columns: fields,
            dateColumn:    findColumn(keys, COLUMN_PATTERNS.date),
            descColumn:    findColumn(keys, COLUMN_PATTERNS.description),
            debitColumn:   findColumn(keys, COLUMN_PATTERNS.debit),
            creditColumn:  findColumn(keys, COLUMN_PATTERNS.credit),
            amountColumn:  !(findColumn(keys, COLUMN_PATTERNS.debit)) && !(findColumn(keys, COLUMN_PATTERNS.credit))
              ? findColumn(keys, COLUMN_PATTERNS.amount)
              : null,
            sampleRows: results.data.slice(0, 3),
          };

          resolve(detected);
        },
        error: reject,
      });
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { parseCSV, detectFormat, parseDate, parseAmount };
