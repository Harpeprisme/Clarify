const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// ─── Yahoo Finance singleton (lazy-loaded) ─────────────────────────────────
let _yf = null;
async function getYF() {
  if (!_yf) {
    const { default: YF } = await import('yahoo-finance2');
    _yf = new YF();
  }
  return _yf;
}

// ─── Shared helpers ────────────────────────────────────────────────────────

/** Parse comma-separated accountIds query param */
const parseAccountIds = (raw) =>
  raw ? raw.split(',').map(Number).filter(Boolean) : [];

/** Build Prisma where clause for brokerage transactions based on request filters */
const buildWhereClause = (userId, { startDate, endDate, accountIds }) => {
  const where = {
    account: { userId },
    OR: [{ isin: { not: null } }, { quantity: { not: null } }],
  };
  if (accountIds.length > 0) where.account = { ...where.account, id: { in: accountIds } };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate)   where.date.lte = new Date(endDate);
  }
  return where;
};

/** Aggregate transactions into a holdings map { [key]: holdingObject } */
const aggregateHoldings = (transactions) => {
  const map = {};
  for (const t of transactions) {
    const key = t.isin || t.description;
    const qty = Math.abs(t.quantity || 0);
    const price = Math.abs(t.unitPrice || 0);
    if (qty === 0 && price === 0) continue;

    if (!map[key]) {
      map[key] = {
        isin: t.isin,
        symbol: t.isin,
        name: t.description,
        currency: t.currency || 'EUR',
        quantity: 0,
        totalCost: 0,
        totalShares: 0,
      };
    }
    const h = map[key];
    const descLower = (t.description || '').toLowerCase();
    const isSell = descLower.includes('vente comptant') || descLower.includes('cession');

    if (isSell) {
      if (h.totalShares > 0) {
        const pru = h.totalCost / h.totalShares;
        h.totalCost   = Math.max(0, h.totalCost   - qty * pru);
        h.totalShares = Math.max(0, h.totalShares - qty);
      }
      h.quantity = Math.max(0, h.quantity - qty);
    } else {
      h.quantity    += qty;
      h.totalShares += qty;
      h.totalCost   += price > 0 ? qty * price : Math.abs(t.amount || 0);
    }
    h.name = t.description;
  }
  return map;
};

/** Resolve ticker from ISIN/ticker string using Yahoo Finance */
const resolveTicker = async (yfInstance, isin) => {
  if (!isin) return null;
  // Already a ticker (contains dot, e.g. WPEA.PA) → use directly
  if (isin.includes('.')) return isin;
  // Real ISIN (12 chars) → search for it
  const sr = await yfInstance.search(isin);
  return sr.quotes?.[0]?.symbol || null;
};

// ─── GET /bourses — Current holdings with live prices ──────────────────────
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      startDate:  req.query.startDate,
      endDate:    req.query.endDate,
      accountIds: parseAccountIds(req.query.accountIds),
    };

    const transactions = await prisma.transaction.findMany({
      where: buildWhereClause(req.user.id, filters),
      include: { account: { include: { accountType: true } } },
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) return res.json([]);

    const holdingsMap = aggregateHoldings(transactions);
    const holdings = Object.values(holdingsMap).filter(h => h.quantity > 0.0001);

    const yfInstance = await getYF().catch(() => null);

    for (const h of holdings) {
      h.pru = h.totalShares > 0 ? h.totalCost / h.totalShares : 0;
      h.currentPrice = h.pru;
      h.dailyChangePercent = 0;

      if (yfInstance && h.isin) {
        try {
          const ticker = await resolveTicker(yfInstance, h.isin);
          if (ticker) {
            const quote = await yfInstance.quote(ticker);
            h.symbol             = ticker;
            h.name               = quote.shortName || quote.longName || h.name;
            h.currentPrice       = quote.regularMarketPrice ?? h.pru;
            h.currency           = quote.currency || h.currency;
            h.dailyChangePercent = quote.regularMarketChangePercent ?? 0;
          }
        } catch (err) {
          console.warn(`[Bourse] Yahoo quote failed for ${h.isin}:`, err.message);
        }
      }

      h.currentValue      = h.quantity * h.currentPrice;
      h.performanceTotal  = h.currentValue - h.totalCost;
      h.performancePercent = h.totalCost > 0 ? (h.performanceTotal / h.totalCost) * 100 : 0;
    }

    res.json(holdings);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
// Returns two time-series arrays for the chart:
//  - priceHistory: [{date, price}] — Yahoo Finance historical prices (weekly)
//  - investHistory: [{date, invested, shares, pru}] — cumulative purchase data
router.get('/history', async (req, res, next) => {
  try {
    const { isin, startDate, endDate } = req.query;
    const accountIds = parseAccountIds(req.query.accountIds);

    if (!isin) return res.status(400).json({ error: 'isin is required' });

    // 1. Fetch brokerage transactions for this ISIN
    const txWhere = {
      account: { userId: req.user.id },
      OR: [{ isin }, { isin: null, description: { contains: isin } }],
    };
    if (accountIds.length > 0) txWhere.account = { ...txWhere.account, id: { in: accountIds } };
    if (startDate || endDate) {
      txWhere.date = {};
      if (startDate) txWhere.date.gte = new Date(startDate);
      if (endDate)   txWhere.date.lte = new Date(endDate);
    }

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      orderBy: { date: 'asc' },
    });

    // 2. Build cumulative user investment curve (one point per transaction)
    let cumulativeShares = 0;
    let cumulativeCost   = 0;
    const investHistory = transactions.map(t => {
      const qty   = Math.abs(t.quantity || 0);
      const price = Math.abs(t.unitPrice || 0);
      const descLower = (t.description || '').toLowerCase();
      const isSell = descLower.includes('vente comptant') || descLower.includes('cession');
      if (isSell) {
        cumulativeShares = Math.max(0, cumulativeShares - qty);
        const pru = cumulativeShares > 0 ? cumulativeCost / (cumulativeShares + qty) : 0;
        cumulativeCost = Math.max(0, cumulativeCost - qty * pru);
      } else {
        cumulativeShares += qty;
        cumulativeCost   += price > 0 ? qty * price : Math.abs(t.amount || 0);
      }
      return {
        date:    t.date,
        shares:  cumulativeShares,
        invested: cumulativeCost,
        pru: cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0,
      };
    });

    // 3. Fetch Yahoo Finance historical prices (weekly) + Benchmarks
    let priceHistory = [];
    let benchmarks = { sp500: [], msciWorld: [], stoxx50: [] };
    
    const yfInstance = await getYF().catch(() => null);
    if (yfInstance) {
      try {
        const ticker = await resolveTicker(yfInstance, isin);
        const from = new Date(startDate || (investHistory.length > 0 ? investHistory[0].date : '2020-01-01'));
        const to   = endDate ? new Date(endDate) : new Date();

        // Asset History
        if (ticker) {
          const hist = await yfInstance.historical(ticker, {
            period1: from,
            period2: to,
            interval: '1wk',
          });
          priceHistory = hist.map(h => ({ date: h.date, price: h.close }));
        }

        // Benchmarks History
        const [spHist, msciHist, stoxxHist] = await Promise.all([
          yfInstance.historical('^GSPC', { period1: from, period2: to, interval: '1wk' }).catch(() => []),
          yfInstance.historical('IWDA.AS', { period1: from, period2: to, interval: '1wk' }).catch(() => []),
          yfInstance.historical('^STOXX50E', { period1: from, period2: to, interval: '1wk' }).catch(() => [])
        ]);

        benchmarks.sp500 = spHist.map(h => ({ date: h.date, price: h.close }));
        benchmarks.msciWorld = msciHist.map(h => ({ date: h.date, price: h.close }));
        benchmarks.stoxx50 = stoxxHist.map(h => ({ date: h.date, price: h.close }));

      } catch (err) {
        console.warn('[Bourse/history] Yahoo historical failed:', err.message);
      }
    }

    res.json({ isin, investHistory, priceHistory, benchmarks });
  } catch (error) {
    next(error);
  }
});

// ─── GET /bourses/search — Yahoo Finance Ticker Search ───────────────────────
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    const yfInstance = await getYF().catch(() => null);
    if (!yfInstance) return res.status(503).json({ error: 'Yahoo Finance unavailable' });
    
    const results = await yfInstance.search(q);
    const quotes = (results.quotes || []).slice(0, 10).map(q => ({
      symbol: q.symbol,
      shortName: q.shortname || q.longname,
      exchange: q.exchDisp,
      type: q.quoteType
    }));
    res.json(quotes);
  } catch (error) {
    next(error);
  }
});

// ─── POST /bourses/compare-performance — DCA vs Hold Custom Benchmark ────────
router.post('/compare-performance', async (req, res, next) => {
  try {
    const { ticker, startDate, endDate, accountIds: accountIdsRaw } = req.body;
    const accountIds = Array.isArray(accountIdsRaw) 
      ? accountIdsRaw.map(Number).filter(Boolean) 
      : (accountIdsRaw ? String(accountIdsRaw).split(',').map(Number).filter(Boolean) : []);

    if (!ticker) return res.status(400).json({ error: 'ticker is required' });

    // 1. Fetch ALL brokerage transactions (no startDate filter to get true base)
    const txWhere = {
      account: { userId: req.user.id },
      OR: [{ isin: { not: null } }, { quantity: { not: null } }],
    };
    if (accountIds.length > 0) txWhere.account = { ...txWhere.account, id: { in: accountIds } };
    if (endDate) txWhere.date = { lte: new Date(endDate) };

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) return res.json([]);

    const firstTxDate = new Date(transactions[0].date);
    const yfInstance = await getYF().catch(() => null);
    if (!yfInstance) return res.status(503).json({ error: 'Yahoo Finance unavailable' });

    const toDate = endDate ? new Date(endDate) : new Date();

    // 2. Resolve ISINs to tickers for Yahoo Finance
    const txByIsin = {};
    for (const t of transactions) {
      if (t.isin) {
        if (!txByIsin[t.isin]) txByIsin[t.isin] = [];
        txByIsin[t.isin].push(t);
      }
    }

    const isins = Object.keys(txByIsin);
    const isinToTicker = {};
    const allTickers = [ticker]; // Benchmark
    
    for (const isin of isins) {
      const isinTicker = await resolveTicker(yfInstance, isin);
      if (isinTicker) {
         isinToTicker[isin] = isinTicker;
         if (!allTickers.includes(isinTicker)) allTickers.push(isinTicker);
      }
    }

    // 3. Fetch Historical Data (1d interval)
    const histData = {}; 
    await Promise.all(allTickers.map(async (tck) => {
       const h = await yfInstance.historical(tck, { period1: firstTxDate, period2: toDate, interval: '1d' }).catch(() => []);
       histData[tck] = Object.fromEntries(h.map(record => [
         record.date.toISOString().slice(0, 10), 
         record.close
       ]));
    }));

    // 4. Generate Date Range & Compute Metrics
    const dates = [];
    let dDate = new Date(firstTxDate);
    dDate.setUTCHours(0,0,0,0);
    const toDateUTC = new Date(toDate);
    toDateUTC.setUTCHours(23,59,59,999);

    while (dDate <= toDateUTC) {
      dates.push(dDate.toISOString().slice(0, 10));
      dDate.setUTCDate(dDate.getUTCDate() + 1);
    }

    const result = [];
    let benchmarkStartPrice = null;
    let lastKnownBenchmark = null;
    const holdings = {}; // { isin: {shares, invested} }
    const lastKnownPrices = {};
    let totalInvested = 0;
    let txIdx = 0;

    for (const dateStr of dates) {
      // Apply transactions strictly <= dateStr
      while (txIdx < transactions.length) {
         const tx = transactions[txIdx];
         const txDateStr = tx.date.toISOString().slice(0, 10);
         if (txDateStr > dateStr) break;

         if (tx.isin) {
           if (!holdings[tx.isin]) holdings[tx.isin] = { shares: 0, invested: 0 };
           const h = holdings[tx.isin];
           const qty = Math.abs(tx.quantity || 0);
           const price = Math.abs(tx.unitPrice || 0);
           const descLower = (tx.description || '').toLowerCase();
           const isSell = descLower.includes('vente comptant') || descLower.includes('cession');

           if (isSell) {
               const pru = h.shares > 0 ? h.invested / h.shares : 0;
               h.shares = Math.max(0, h.shares - qty);
               const cost = qty * pru;
               h.invested = Math.max(0, h.invested - cost);
               totalInvested = Math.max(0, totalInvested - cost);
           } else {
               h.shares += qty;
               const cost = price > 0 ? qty * price : Math.abs(tx.amount || 0);
               h.invested += cost;
               totalInvested += cost;
           }
         }
         txIdx++;
      }

      // Portfolio Value Calculation
      let portfolioValue = 0;
      for (const isin of Object.keys(holdings)) {
         if (holdings[isin].shares === 0) continue;
         const tck = isinToTicker[isin];
         let p = histData[tck]?.[dateStr] ?? lastKnownPrices[isin];
         if (p !== undefined) lastKnownPrices[isin] = p;
         portfolioValue += holdings[isin].shares * (p || 0);
      }

      // Benchmark Hold Calculation
      let benchPrice = histData[ticker]?.[dateStr] ?? lastKnownBenchmark;
      if (benchPrice !== undefined) lastKnownBenchmark = benchPrice;

      if (benchmarkStartPrice === null && benchPrice !== undefined) {
          benchmarkStartPrice = benchPrice;
      }

      let perf_hold = null;
      if (benchmarkStartPrice !== null && benchPrice !== null && benchPrice !== undefined) {
          perf_hold = ((benchPrice - benchmarkStartPrice) / benchmarkStartPrice) * 100;
      }

      // DCA Calculation
      let perf_dca = null;
      if (totalInvested > 0 && portfolioValue > 0) {
          perf_dca = ((portfolioValue - totalInvested) / totalInvested) * 100;
      }

      // Filter by requested startDate for output
      if (!startDate || dateStr >= startDate.slice(0, 10)) {
         result.push({
           date: dateStr,
           perf_hold: perf_hold !== null ? Number(perf_hold.toFixed(2)) : null,
           perf_dca: perf_dca !== null ? Number(perf_dca.toFixed(2)) : null
         });
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
