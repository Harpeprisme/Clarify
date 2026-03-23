/**
 * OFX / QFX Parser
 * ================
 * Handles Open Financial Exchange files (.ofx, .qfx).
 * OFX is SGML-based; we convert it to XML then traverse
 * the STMTTRN (statement transaction) nodes.
 */

const { XMLParser } = require('fast-xml-parser');

/**
 * Convert OFX SGML into a parseable string by fixing unclosed tags.
 * OFX 1.x is non-standard SGML — tags are on separate lines with no closing tags.
 * @param {string} text
 * @returns {string} cleaned XML-like string
 */
function sgmlToXml(text) {
  // Strip OFX headers (lines before <OFX>)
  const startIndex = text.indexOf('<OFX>');
  if (startIndex === -1) throw new Error('Tag <OFX> introuvable — est-ce bien un fichier OFX ?');
  let body = text.slice(startIndex);

  // Self-close all leaf tags (tags containing a value on the same line)
  // e.g.  <TRNAMT>-42.50   →   <TRNAMT>-42.50</TRNAMT>
  body = body.replace(/<([A-Z0-9._]+)>([^<\n\r]+)/g, (match, tag, value) => {
    return `<${tag}>${value.trim()}</${tag}>`;
  });

  return body;
}

/**
 * Parse an OFX/QFX buffer and return normalized transaction rows.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{date, description, amount, type}>>}
 */
async function parseOFX(buffer) {
  const text = buffer.toString('utf-8').replace(/\r/g, '');

  const xmlText = sgmlToXml(text);

  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
  const doc = parser.parse(xmlText);

  // Navigate to transaction list (BANKMSGSRSV1 or CREDITCARDMSGSRSV1)
  const ofx = doc?.OFX || {};
  const bankRs = ofx.BANKMSGSRSV1?.STMTTRNRS?.STMTRS ||
                 ofx.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS;

  if (!bankRs) throw new Error('Structure OFX non reconnue. Vérifiez que le fichier est un relevé bancaire valide.');

  let transactions = bankRs.BANKTRANLIST?.STMTTRN || [];
  if (!Array.isArray(transactions)) transactions = [transactions];

  const results = [];

  for (const tx of transactions) {
    // DTPOSTED format: 20231225 or 20231225120000[+01:00 EST]
    const rawDate = String(tx.DTPOSTED || '').substring(0, 8);
    if (!rawDate || rawDate.length < 8) continue;

    const dateStr = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
    const date = new Date(dateStr);
    if (isNaN(date)) continue;

    const amount = parseFloat(String(tx.TRNAMT || '0').replace(',', '.'));
    if (isNaN(amount)) continue;

    const description = String(tx.NAME || tx.MEMO || tx.PAYEEID || '').trim() || 'Transaction OFX';

    results.push({
      date: date.toISOString(),
      description,
      amount,
      type: amount >= 0 ? 'INCOME' : 'EXPENSE',
    });
  }

  return results;
}

module.exports = { parseOFX };
