// PDF parser diagnostic script
// Run with: node scripts/testPdf.js

const { parsePDF } = require('../src/services/pdfParser');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../Imports');

async function main() {
  const pdfs = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
  
  for (const f of pdfs) {
    const buf = fs.readFileSync(path.join(dir, f));
    try {
      const rows = await parsePDF(buf);
      console.log('OK:' + rows.length + ' | ' + f);
      rows.slice(0, 4).forEach(r => {
        const sign = r.amount > 0 ? '+' : '';
        console.log('  ' + r.date.substring(0,10) + '  ' + sign + r.amount + '  ' + r.description.substring(0,60));
      });
    } catch(e) {
      console.log('FAIL | ' + f + '\n  => ' + e.message.substring(0,100));
    }
    console.log('');
  }
}

main().catch(console.error);
