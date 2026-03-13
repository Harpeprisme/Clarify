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

function buildWhere({ startDate, endDate, accountIds, userId }) {
  const where = {};
  if (userId) {
    where.account = { userId };
  }
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

    const userAccounts = await prisma.account.findMany({
      where: { userId: req.user.id }
    });
    const userAccountIds = userAccounts.map(a => a.id);
    const validAccountIds = accountIds.length > 0
      ? accountIds.filter(id => userAccountIds.includes(id))
      : userAccountIds;

    const periodWhere = buildWhere({ startDate, endDate, accountIds: validAccountIds, userId: req.user.id });
    const accountWhere = { account: { userId: req.user.id } };
    if (validAccountIds.length > 0) {
      accountWhere.accountId = { in: validAccountIds };
    }

    // Even if no specific accounts are requested, the `userId` filter ensures 
    // we only analyze the current user's data (or return exactly 0 if they don't have accounts).

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
      userAccounts.map(async (acc) => {
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

    // Sum of initialBalances for selected accounts (or all user's accounts if none selected in validAccountIds)
    const selectedAccountsForInitial = validAccountIds.length > 0
      ? userAccounts.filter(a => validAccountIds.includes(a.id))
      : userAccounts;
    const sumInitial = selectedAccountsForInitial.reduce((s, a) => s + a.initialBalance, 0);
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
