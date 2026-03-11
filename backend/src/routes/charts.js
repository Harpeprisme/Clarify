/**
 * GET /api/charts/expenses-by-category  → Pie/doughnut
 * GET /api/charts/income-vs-expenses    → Bar chart (monthly)
 * GET /api/charts/balance-evolution     → Line chart (daily running balance)
 *
 * All accept: startDate, endDate, accountIds (comma-separated)
 */
const express = require('express');
const router  = express.Router();
const prisma  = require('../config/prisma');

// ── Shared helper ────────────────────────────────────────────────────────────
function buildWhere({ startDate, endDate, accountIds }) {
  const where = {};
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate)   where.date.lte = new Date(endDate);
  }
  if (accountIds && accountIds.length > 0) {
    where.accountId = { in: accountIds };
  }
  return where;
}

function parseAccountIds(req) {
  if (req.query.accountIds) return req.query.accountIds.split(',').map(Number).filter(Boolean);
  if (req.query.accountId)  return [parseInt(req.query.accountId)].filter(Boolean);
  return [];
}

// ── Expenses by category (Doughnut) ─────────────────────────────────────────
router.get('/expenses-by-category', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const accountIds = parseAccountIds(req);

    const where = {
      ...buildWhere({ startDate, endDate, accountIds }),
      type: 'EXPENSE',
      isInternal: false,
    };

    const [categories, results] = await Promise.all([
      prisma.category.findMany(),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
      }),
    ]);

    const formatted = results
      .filter(r => r.categoryId && r._sum.amount)
      .map(r => {
        const cat = categories.find(c => c.id === r.categoryId);
        return {
          name:  cat?.name  ?? 'Non catégorisé',
          color: cat?.color ?? '#9CA3AF',
          value: Math.abs(r._sum.amount),
        };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);

    res.json(formatted);
  } catch (err) { next(err); }
});

// ── Income vs Expenses per month (Bar chart) ─────────────────────────────────
router.get('/income-vs-expenses', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const accountIds = parseAccountIds(req);

    const where = {
      ...buildWhere({ startDate, endDate, accountIds }),
      isInternal: false,
    };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'asc' },
      select: { date: true, amount: true, type: true },
    });

    const monthly = {};
    for (const t of transactions) {
      const key = t.date.toISOString().slice(0, 7); // YYYY-MM
      if (!monthly[key]) monthly[key] = { month: key, income: 0, expense: 0 };
      if (t.type === 'INCOME')  monthly[key].income  += t.amount;
      if (t.type === 'EXPENSE') monthly[key].expense += Math.abs(t.amount);
    }

    const result = Object.values(monthly)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({ ...m, savings: m.income - m.expense }));

    res.json(result);
  } catch (err) { next(err); }
});

// ── Balance evolution (Line chart) ───────────────────────────────────────────
router.get('/balance-evolution', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const accountIds = parseAccountIds(req);

    // Fetch all transactions for selected accounts (no date filter — need full history)
    const allWhere = accountIds.length > 0 ? { accountId: { in: accountIds } } : {};

    // Fetch accounts to get initialBalance seed values
    const accounts = await prisma.account.findMany({
      where: accountIds.length > 0 ? { id: { in: accountIds } } : {},
    });
    const initialSeed = accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0);

    const allTransactions = await prisma.transaction.findMany({
      where: allWhere,
      orderBy: { date: 'asc' },
      select: { date: true, amount: true },
    });

    // Compute daily running balance — start from initialBalance seed
    const daily = {};
    for (const t of allTransactions) {
      const day = t.date.toISOString().slice(0, 10);
      daily[day] = (daily[day] ?? 0) + t.amount;
    }

    let running = initialSeed;
    const full = Object.keys(daily)
      .sort()
      .map(day => {
        running += daily[day];
        return { date: day, balance: parseFloat(running.toFixed(2)) };
      });

    // Filter to the selected date window
    const visible = full.filter(p => {
      if (startDate && p.date < startDate) return false;
      if (endDate   && p.date > endDate)   return false;
      return true;
    });

    // Prepend the last-known point just before startDate so line doesn't jump
    let result = visible;
    if (startDate && full.length > 0) {
      const lastBefore = full.filter(p => p.date < startDate).slice(-1)[0];
      if (lastBefore) result = [lastBefore, ...visible];
    }

    // If no transactions at all, return a single point with initialSeed
    if (result.length === 0 && initialSeed !== 0) {
      result = [{ date: startDate || new Date().toISOString().slice(0,10), balance: initialSeed }];
    }

    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
