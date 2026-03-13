/**
 * GET /api/analysis
 * Query params: startDate, endDate, accountIds (comma-separated)
 *
 * Returns:
 *  - bigExpenses: top 15 biggest expenses in selected period
 *  - averages: average monthly spend per category in selected period
 */
const express = require('express');
const router  = express.Router();
const prisma  = require('../config/prisma');

function buildWhere({ startDate, endDate }) {
  const where = {};
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate)   where.date.lte = new Date(endDate);
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
      where: { userId: req.user.id },
      select: { id: true }
    });
    const userAccountIds = userAccounts.map(a => a.id);
    const validAccountIds = accountIds.length > 0 
      ? accountIds.filter(id => userAccountIds.includes(id))
      : userAccountIds;

    const baseWhere = {
      ...buildWhere({ startDate, endDate }),
      account: { userId: req.user.id },
      accountId: { in: validAccountIds },
      type: 'EXPENSE',
      isInternal: false,
    };

    console.log(`🔍 [Analysis] user: ${req.user.id}, startDate: ${startDate}, endDate: ${endDate}, validAccountIds: ${validAccountIds}`);
    console.log(`🔍 [Analysis] baseWhere: ${JSON.stringify(baseWhere)}`);

    // Top 15 biggest expenses (most negative amount first)
    const bigExpenses = await prisma.transaction.findMany({
      where: baseWhere,
      orderBy: { amount: 'asc' },
      take: 15,
      include: { category: true, account: true },
    });

    // Monthly average per category
    let monthCount = 3;
    if (startDate && endDate) {
      const ms = new Date(endDate) - new Date(startDate);
      monthCount = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
    } else if (startDate) {
      const ms = new Date() - new Date(startDate);
      monthCount = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
    }

    const [stats, categories] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: baseWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.category.findMany({
        where: {
          OR: [{ userId: req.user.id }, { userId: null }]
        }
      }),
    ]);

    const averages = stats
      .filter(t => t.categoryId)
      .map(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        return {
          categoryName:   cat?.name  ?? 'Inconnu',
          color:          cat?.color ?? '#9CA3AF',
          averageMonthly: Math.abs((t._sum.amount || 0) / monthCount),
          totalCount:     t._count.id,
        };
      })
      .sort((a, b) => b.averageMonthly - a.averageMonthly);

    res.json({ bigExpenses, averages });
  } catch (err) { next(err); }
});

module.exports = router;
