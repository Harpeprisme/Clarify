const yahooFinance = require('yahoo-finance2');

async function test() {
  try {
    const search = await yahooFinance.search('iShares MSCI World Swap PEA UCITS ETF');
    console.log(JSON.stringify(search.quotes.slice(0, 3), null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
