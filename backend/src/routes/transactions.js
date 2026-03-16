const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// GET /api/transactions — list with filters + pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      startDate, endDate, categoryId,
      accountId, accountIds: accountIdsParam,
      minAmount, maxAmount, search,
      type, excludeInternal,
      page = 1, limit = 20
    } = req.query;

    const where = {
      account: { userId: req.user.id }
    };
    
    // REQUIRE ownership through account
    const userAccounts = await prisma.account.findMany({
      where: { userId: req.user.id },
      select: { id: true }
    });
    const userAccountIds = userAccounts.map(a => a.id);

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(endDate);
    }
    if (categoryId) where.categoryId = parseInt(categoryId);

    // Filter by user's accounts
    if (accountIdsParam) {
      const requestedIds = accountIdsParam.split(',').map(Number).filter(Boolean);
      const validIds = requestedIds.filter(id => userAccountIds.includes(id));
      if (validIds.length === 0) where.accountId = { in: userAccountIds };
      else where.accountId = { in: validIds };
    } else if (accountId) {
      const id = parseInt(accountId);
      where.accountId = userAccountIds.includes(id) ? id : { in: userAccountIds };
    } else {
      where.accountId = { in: userAccountIds };
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }
    if (search) where.description = { contains: search };
    if (type) where.type = type;
    if (excludeInternal === 'true') where.isInternal = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [totalCount, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: { category: true, account: true },
        orderBy: { date: 'desc' },
        skip, take
      })
    ]);

    res.json({
      data: transactions,
      meta: {
        total: totalCount,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(totalCount / take)
      }
    });
  } catch (error) { next(error); }
});

// POST /api/transactions — create a transaction manually
router.post('/', async (req, res, next) => {
  try {
    const { date, description, amount, type, accountId, categoryId, notes } = req.body;
    if (!date || !description || amount === undefined || !accountId) {
      return res.status(400).json({ error: 'date, description, amount et accountId sont requis.' });
    }

    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: parseInt(accountId), userId: req.user.id }
    });
    if (!account) return res.status(403).json({ error: 'Accès au compte refusé' });

    const parsedAmount = parseFloat(amount);
    const resolvedType = type || (parsedAmount >= 0 ? 'INCOME' : 'EXPENSE');

    const tx = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description: String(description).trim(),
        amount: parsedAmount,
        type: resolvedType,
        accountId: account.id,
        categoryId: categoryId ? parseInt(categoryId) : null,
        notes: notes || null,
      },
      include: { category: true, account: true }
    });
    res.status(201).json(tx);
  } catch (error) { next(error); }
});

// PATCH /api/transactions/:id ──
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { date, description, amount, type, accountId, categoryId, notes } = req.body;

    // Verify transaction ownership through account
    const existingTx = await prisma.transaction.findFirst({
        where: { id, account: { userId: req.user.id } }
    });
    if (!existingTx) return res.status(404).json({ error: 'Transaction introuvable' });

    const updateData = {};
    if (date        !== undefined) updateData.date        = new Date(date);
    if (description !== undefined) updateData.description = String(description).trim();
    if (amount      !== undefined) {
      updateData.amount = parseFloat(amount);
      if (type === undefined) updateData.type = updateData.amount >= 0 ? 'INCOME' : 'EXPENSE';
    }
    if (type        !== undefined) updateData.type        = type;
    if (accountId   !== undefined) {
        // Verify NEW account ownership
        const newAcc = await prisma.account.findFirst({
            where: { id: parseInt(accountId), userId: req.user.id }
        });
        if (!newAcc) return res.status(403).json({ error: 'Accès au nouveau compte refusé' });
        updateData.accountId = newAcc.id;
    }
    if (categoryId  !== undefined) updateData.categoryId  = categoryId ? parseInt(categoryId) : null;
    if (notes       !== undefined) updateData.notes       = notes;
    if (req.body.isPointed !== undefined) updateData.isPointed = Boolean(req.body.isPointed);

    const updated = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: { category: true, account: true }
    });
    res.json(updated);
  } catch (error) { next(error); }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const existingTx = await prisma.transaction.findFirst({
        where: { id, account: { userId: req.user.id } }
    });
    if (!existingTx) return res.status(404).json({ error: 'Transaction introuvable' });

    await prisma.transaction.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

module.exports = router;
