const express = require('express');
const router  = express.Router();
const prisma  = require('../config/prisma');

// ── GET all accounts with their REAL balance (initialBalance + transactions) ──
router.get('/', async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({ orderBy: { name: 'asc' } });

    const accountsWithBalances = await Promise.all(
      accounts.map(async (acc) => {
        const result = await prisma.transaction.aggregate({
          where: { accountId: acc.id },
          _sum: { amount: true },
        });
        const txSum = result._sum.amount || 0;
        return {
          ...acc,
          // Real balance = seed balance + all transactions
          balance: acc.initialBalance + txSum,
          txBalance: txSum, // transactions-only sum (useful for debug)
        };
      })
    );

    res.json(accountsWithBalances);
  } catch (err) { next(err); }
});

// ── POST — create account ────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, type, currentBalance } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const account = await prisma.account.create({
      data: {
        name,
        type:           type || 'COURANT',
        initialBalance: currentBalance !== undefined && currentBalance !== '' ? parseFloat(currentBalance) : 0,
      },
    });

    res.status(201).json({ ...account, balance: account.initialBalance });
  } catch (err) { next(err); }
});

// ── PATCH — update account (name, type, currentBalance) ──
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, type, currentBalance } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;

    if (currentBalance !== undefined && currentBalance !== '') {
      // Substract existing tx sum to find the required initialBalance seed
      const txRes = await prisma.transaction.aggregate({
        where: { accountId: id },
        _sum: { amount: true },
      });
      const txSum = txRes._sum.amount || 0;
      data.initialBalance = parseFloat(currentBalance) - txSum;
    }

    const account = await prisma.account.update({ where: { id }, data });
    res.json(account);
  } catch (err) { next(err); }
});

// ── DELETE account (cascades to transactions) ────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.account.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── DELETE /accounts/:id/transactions — clear history, keep account ──────────
router.delete('/:id/transactions', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await Promise.all([
      prisma.transaction.deleteMany({ where: { accountId: id } }),
      prisma.importHistory.deleteMany({ where: { accountId: id } }),
    ]);
    res.json({ deleted: deleted.count });
  } catch (err) { next(err); }
});

module.exports = router;
