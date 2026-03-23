/**
 * Excel Bank Statement Parser (.xlsx / .xls)
 * ==========================================
 * Uses SheetJS (xlsx) to read workbooks and applies the same metadata-skip
 * logic as csvParser to handle bank files with info headers before the data.
 *
 * Handles Crédit Agricole and other French/European bank Excel exports.
 */

const XLSX = require('xlsx');
const { normalizeColumns, normalizeRow, parseDate, parseAmount } = require('./parserUtils');

/**
 * Find the row index where real column headers start.
 * The real header row is the first row where at least 3 cells contain
 * recognizable column names (date, libellé, montant, débit, crédit...).
 */
function findHeaderRow(rows) {
  const KNOWN_HEADERS = [
    /date/i, /libell/i, /d.bit/i, /cr.dit/i, /montant/i,
    /description/i, /operation/i, /opération/i, /label/i,
  ];

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    let matches = 0;
    for (const cell of row) {
      const s = String(cell || '').trim();
      if (KNOWN_HEADERS.some(re => re.test(s))) matches++;
    }
    if (matches >= 2) return i;
  }
  return 0;
}

/**
 * Convert Excel serial date number to ISO date string.
 * Excel dates are stored as days since 1900-01-00 (with 1900 leap year bug).
 */
function excelSerialToDate(serial) {
  if (!serial || isNaN(serial)) return null;
  // XLSX's built-in parser with cellDates handles this but sometimes returns numbers
  const date = XLSX.SSF.parse_date_code(serial);
  if (!date) return null;
  const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
  if (isNaN(d)) return null;
  return d.toISOString();
}

/**
 * Parse an amount cell. Excel amounts are often stored as positive numbers
 * with debit/credit determined by which column they appear in.
 */
function parseExcelAmount(debitVal, creditVal, amountVal) {
  // Try unified amount column first
  if (amountVal !== '' && amountVal !== null && amountVal !== undefined) {
    const a = typeof amountVal === 'number' ? amountVal : parseAmount(String(amountVal));
    if (a !== null) return a;
  }

  // Split debit/credit columns
  const debit  = debitVal  !== '' ? (typeof debitVal  === 'number' ? Math.abs(debitVal)  : parseAmount(String(debitVal)))  : null;
  const credit = creditVal !== '' ? (typeof creditVal === 'number' ? Math.abs(creditVal) : parseAmount(String(creditVal))) : null;

  if (debit  && debit  > 0) return -debit;  // debit = money out
  if (credit && credit > 0) return credit;  // credit = money in
  return null;
}

/**
 * Parse an Excel buffer and return normalized transaction rows.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{date, description, amount, type}>>}
 */
async function parseExcel(buffer) {
  // Read with raw:true to get serial dates as numbers, not auto-parsed strings
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: false });

  // Use the first non-empty sheet
  const sheetName = workbook.SheetNames.find(n => {
    const ws = workbook.Sheets[n];
    return ws && Object.keys(ws).length > 2;
  }) || workbook.SheetNames[0];

  const ws = workbook.Sheets[sheetName];

  // Convert to 2D array to find the real header row
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!allRows.length) throw new Error('Fichier Excel vide.');

  const headerRowIdx = findHeaderRow(allRows);
  const headerRow = allRows[headerRowIdx];

  if (!headerRow || !headerRow.some(Boolean)) {
    throw new Error('En-tête de colonnes intro‌uvable dans ce fichier Excel.');
  }

  // Detect column roles
  const mapping = normalizeColumns(headerRow.map(String));

  if (!mapping.date) {
    throw new Error(
      `Colonne "date" introuvable dans ce fichier Excel. ` +
      `Colonnes trouvées : ${headerRow.filter(Boolean).join(', ')}`
    );
  }

  if (!mapping.amount && !mapping.debit && !mapping.credit) {
    throw new Error(
      `Colonne montant introuvable. ` +
      `Colonnes trouvées : ${headerRow.filter(Boolean).join(', ')}`
    );
  }

  // Map header names to their indices
  const colIndex = {};
  headerRow.forEach((name, i) => { colIndex[String(name)] = i; });

  const results = [];

  for (let r = headerRowIdx + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

    // Date: might be Excel serial or a string
    const rawDate = row[colIndex[mapping.date]];
    let dateStr = null;

    if (typeof rawDate === 'number') {
      dateStr = excelSerialToDate(rawDate);
    } else {
      dateStr = parseDate(String(rawDate || '').trim());
    }

    if (!dateStr) continue;

    // Description
    const description = String(row[colIndex[mapping.description]] || '').replace(/\s+/g, ' ').trim() || 'Transaction';

    // Amount
    const debitRaw  = mapping.debit  !== undefined ? row[colIndex[mapping.debit]]  : '';
    const creditRaw = mapping.credit !== undefined ? row[colIndex[mapping.credit]] : '';
    const amtRaw    = mapping.amount !== undefined ? row[colIndex[mapping.amount]] : undefined;

    const amount = parseExcelAmount(debitRaw, creditRaw, amtRaw);
    if (amount === null) continue;

    results.push({
      date: dateStr,
      description,
      amount,
      type: amount >= 0 ? 'INCOME' : 'EXPENSE',
    });
  }

  return results;
}

module.exports = { parseExcel };
