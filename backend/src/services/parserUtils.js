/**
 * Shared Parser Utilities
 * ========================
 * Column detection and row normalization shared by all parsers
 * (Excel, CSV, PDF, etc.). Extracted from csvParser logic.
 */

const { parse, isValid } = require('date-fns');

// ── Column name patterns (same as csvParser) ────────────────────────────────
const COLUMN_PATTERNS = {
  date: [
    /^date$/,
    /^date op/,
    /^date d.op/,
    /^date de (l.op|val|compt)/,
    /^date (valeur|comptable)/,
    /^date d.ex/,
    /^value date/,
    /^posting date/,
    /^transaction date/,
  ],
  description: [
    /libell/,
    /description/,
    /motif/,
    /d.tails/,
    /label/,
    /^op.ration$/,
    /r.f.rence/,
    /communication/,
    /objet/,
    /wording/,
    /narrative/,
    /particulars/,
    /payee/,
    /memo/,
    /^name/,
    /^benefic/,
  ],
  debit: [
    /d.bit/,
    /retrait/,
    /sortie/,
    /withdrawal/,
    /^debit\b/,
    /charges/,
    /^(out|dr)\b/,
  ],
  credit: [
    /cr.dit/,
    /versement/,
    /entr.e/,
    /deposit/,
    /^credit\b/,
    /^(in|cr)\b/,
  ],
  amount: [
    /^montant$/,
    /^montant net$/,
    /^montant brut$/,
    /^(montant|amount) (en |op|tot)/,
    /^sum$/,
    /transaction amount/,
    /^paid (in|out)/,
    /montant net/,
    /net amount/,
    /net cash/,
    /^total$/,
    /^r.gl/,
    /^amount\b/,
    /^value\b/,
  ],
};

// ── Date formats ─────────────────────────────────────────────────────────────
const DATE_FORMATS = [
  'dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'dd/MM/yy',
  'MM/dd/yyyy', 'dd.MM.yyyy', 'yyyyMMdd', 'd/M/yyyy',
  'd MMM yyyy', 'yyyy/MM/dd',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const findColumn = (keys, patterns) => {
  for (const pattern of patterns) {
    const found = keys.find(k => pattern.test(norm(k)));
    if (found) return found;
  }
  return null;
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const cleaned = String(dateStr).trim().replace(/\s+/g, ' ');
  for (const fmt of DATE_FORMATS) {
    const d = parse(cleaned, fmt, new Date());
    if (isValid(d) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
      return d.toISOString();
    }
  }
  const d = new Date(cleaned);
  if (isValid(d) && d.getFullYear() > 1990) return d.toISOString();
  return null;
};

const parseAmount = (amountStr) => {
  if (!amountStr || String(amountStr).trim() === '') return null;
  let s = String(amountStr)
    .replace(/€|\$|£|USD|EUR|GBP/gi, '')
    .replace(/\u00a0/g, '')
    .trim();

  const hasCommaDecimal = /,\d{1,2}$/.test(s);
  if (hasCommaDecimal) {
    s = s.replace(/[\s.]/g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const val = parseFloat(s);
  return isNaN(val) ? null : val;
};

/**
 * Detect column roles from a list of header names.
 * @param {string[]} keys
 * @returns {{ date, description, amount, debit, credit }}
 */
function normalizeColumns(keys) {
  return {
    date:        findColumn(keys, COLUMN_PATTERNS.date),
    description: findColumn(keys, COLUMN_PATTERNS.description),
    amount:      findColumn(keys, COLUMN_PATTERNS.amount),
    debit:       findColumn(keys, COLUMN_PATTERNS.debit),
    credit:      findColumn(keys, COLUMN_PATTERNS.credit),
  };
}

/**
 * Convert a raw row object into a normalized transaction.
 * @param {Object} row
 * @param {{ date, description, amount, debit, credit }} mapping
 * @returns {{ date, description, amount, type } | null}
 */
function normalizeRow(row, mapping) {
  const date = parseDate(row[mapping.date]);
  if (!date) return null;

  const description = String(row[mapping.description] || '').trim() || 'Transaction';

  let amount = null;

  if (mapping.amount) {
    amount = parseAmount(row[mapping.amount]);
  }

  // Split debit/credit columns
  if (amount === null || amount === 0) {
    const debit  = mapping.debit  ? parseAmount(row[mapping.debit])  : null;
    const credit = mapping.credit ? parseAmount(row[mapping.credit]) : null;
    if (debit  && !isNaN(debit)  && Math.abs(debit)  > 0) amount = -Math.abs(debit);
    if (credit && !isNaN(credit) && Math.abs(credit) > 0) amount = Math.abs(credit);
  }

  if (amount === null || isNaN(amount)) return null;

  return {
    date,
    description,
    amount,
    type: amount >= 0 ? 'INCOME' : 'EXPENSE',
  };
}

module.exports = { normalizeColumns, normalizeRow, parseDate, parseAmount };
