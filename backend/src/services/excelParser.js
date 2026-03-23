/**
 * Excel Bank Statement Parser (.xlsx / .xls)
 * ==========================================
 * Uses SheetJS (xlsx) to read workbooks and applies the same column
 * detection heuristics as csvParser (date / libellé / montant).
 */

const XLSX = require('xlsx');
const { normalizeColumns, normalizeRow } = require('./parserUtils');

/**
 * Parse an Excel buffer and return normalized transaction rows.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{date, description, amount, type}>>}
 */
async function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Use the first non-empty sheet
  const sheetName = workbook.SheetNames.find(n => {
    const ws = workbook.Sheets[n];
    return ws && Object.keys(ws).length > 2;
  }) || workbook.SheetNames[0];

  const ws = workbook.Sheets[sheetName];

  // Convert to array-of-objects (first row as header)
  const rawRows = XLSX.utils.sheet_to_json(ws, {
    raw: false,          // parse numbers and dates as strings
    defval: '',
    dateNF:  'yyyy-mm-dd',
  });

  if (!rawRows.length) throw new Error('Aucune donnée trouvée dans le fichier Excel.');

  // Detect columns using shared utility
  const columns = Object.keys(rawRows[0]);
  const mapping = normalizeColumns(columns);

  if (!mapping.date || (!mapping.amount && !mapping.debit && !mapping.credit)) {
    throw new Error(
      'Colonnes date/montant introuvables dans ce fichier Excel. ' +
      `Colonnes trouvées : ${columns.join(', ')}`
    );
  }

  const results = [];
  for (const row of rawRows) {
    const normalized = normalizeRow(row, mapping);
    if (normalized) results.push(normalized);
  }

  return results;
}

module.exports = { parseExcel };
