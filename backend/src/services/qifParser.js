/**
 * QIF Parser — Quicken Interchange Format
 * =========================================
 * Parses .qif files from Quicken and compatible accounting software.
 *
 * QIF format:
 *   !Type:Bank
 *   D01/25/2024       ← Date
 *   T-42.50           ← Amount (T = total)
 *   PCarrefour        ← Payee
 *   MOptional memo    ← Memo
 *   ^                 ← End of record separator
 */

const DATE_FORMATS_QIF = [
  // MM/DD/YYYY (US)
  { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, fn: (m) => `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` },
  // DD/MM/YYYY (EU)
  { re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, fn: (m) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
  // DD.MM.YYYY
  { re: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, fn: (m) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
  // YYYY-MM-DD (ISO)
  { re: /^(\d{4})-(\d{2})-(\d{2})$/, fn: (m) => m[0] },
];

function parseQIFDate(raw) {
  const str = raw.trim().replace("'", '/'); // Some QIF use apostrophe for 2-digit year
  for (const { re, fn } of DATE_FORMATS_QIF) {
    const m = str.match(re);
    if (m) {
      const iso = fn(m);
      const d = new Date(iso);
      if (!isNaN(d)) return d.toISOString();
    }
  }
  return null;
}

/**
 * Parse a QIF buffer into normalized transaction rows.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{date, description, amount, type}>>}
 */
async function parseQIF(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/);
  const results = [];

  let currentRecord = {};

  for (const line of lines) {
    if (!line.trim()) continue;

    const code = line[0];
    const value = line.slice(1).trim();

    switch (code) {
      case 'D': currentRecord.date = value; break;
      case 'T': currentRecord.amount = value; break;
      case 'U': if (!currentRecord.amount) currentRecord.amount = value; break; // U = same as T but uncleared
      case 'P': currentRecord.payee = value; break;
      case 'M': currentRecord.memo = value; break;
      case '^': {
        // End of record — commit
        if (currentRecord.date && currentRecord.amount) {
          const date = parseQIFDate(currentRecord.date);
          const amount = parseFloat(
            String(currentRecord.amount)
              .replace(/\s/g, '')
              .replace(',', '.')
              .replace(/(?<=\d)\.(?=\d{3}($|\D))/, '') // remove thousands separator
          );

          if (date && !isNaN(amount)) {
            const description = (currentRecord.payee || currentRecord.memo || 'Transaction QIF').trim();
            results.push({
              date,
              description,
              amount,
              type: amount >= 0 ? 'INCOME' : 'EXPENSE',
            });
          }
        }
        currentRecord = {};
        break;
      }
      // Ignore other codes (C clearance, L category, N check number, etc.)
    }
  }

  return results;
}

module.exports = { parseQIF };
