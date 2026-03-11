/**
 * GET /api/dashboard
 * Query params: startDate, endDate, accountIds (comma-separated)
 *
 * totalBalance  = sum(account.initialBalance) + sum(all transactions)
 * period KPIs   = computed strictly within the filtered date window
 */
const express = require('express');
const router  = express.Router();
const prisma  = require('../config/prisma');

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

router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const accountIds = parseAccountIds(req);

    const periodWhere = buildWhere({ startDate, endDate, accountIds });
    const accountWhere = accountIds.length > 0 ? { accountId: { in: accountIds } } : {};

    // Fetch accounts (always all) — needed for initialBalance
    const accounts = await prisma.account.findMany({ orderBy: { name: 'asc' } });

    const [periodIncome, periodExpense, recentTransactions, txTotalResult] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...periodWhere, type: 'INCOME', isInternal: false },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...periodWhere, type: 'EXPENSE', isInternal: false },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: periodWhere,
        take: 10,
        orderBy: { date: 'desc' },
        include: { category: true, account: true },
      }),
      // All-time transactions total (for selected accounts)
      prisma.transaction.aggregate({
        where: accountWhere,
        _sum: { amount: true },
      }),
    ]);

    // Per-account all-time balance = initialBalance + sum(tx)
    const accountsWithBalance = await Promise.all(
      accounts.map(async (acc) => {
        const res = await prisma.transaction.aggregate({
          where: { accountId: acc.id },
          _sum: { amount: true },
        });
        return {
          id:                 acc.id,
          name:               acc.name,
          type:               acc.type,
          initialBalance:     acc.initialBalance,
          initialBalanceDate: acc.initialBalanceDate,
          balance:            acc.initialBalance + (res._sum.amount || 0),
        };
      })
    );

    // Sum of initialBalances for selected accounts (or all if none selected)
    const selectedAccounts = accountIds.length > 0
      ? accounts.filter(a => accountIds.includes(a.id))
      : accounts;
    const sumInitial = selectedAccounts.reduce((s, a) => s + a.initialBalance, 0);
    const txTotal    = txTotalResult._sum.amount || 0;

    const income  = periodIncome._sum.amount  || 0;
    const expense = periodExpense._sum.amount || 0;

    res.json({
      totalBalance: sumInitial + txTotal,
      period: {
        income,
        expense: Math.abs(expense),
        savings: income - Math.abs(expense),
      },
      accounts: accountsWithBalance,
      recentTransactions,
    });
  } catch (err) { next(err); }
});

module.exports = router;
