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

    const where = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(endDate);
    }
    if (categoryId) where.categoryId = parseInt(categoryId);

    // Support both accountIds=1,2,3 (new) and accountId=1 (legacy)
    if (accountIdsParam) {
      const ids = accountIdsParam.split(',').map(Number).filter(Boolean);
      if (ids.length === 1) where.accountId = ids[0];
      else if (ids.length > 1) where.accountId = { in: ids };
    } else if (accountId) {
      where.accountId = parseInt(accountId);
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }
    if (search) where.description = { contains: search };
    
    // New KPI filters
    if (type) {
      where.type = type;
    }
    if (excludeInternal === 'true') {
      where.isInternal = false;
    }

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
    const parsedAmount = parseFloat(amount);
    const resolvedType = type || (parsedAmount >= 0 ? 'INCOME' : 'EXPENSE');

    const tx = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description: String(description).trim(),
        amount: parsedAmount,
        type: resolvedType,
        accountId: parseInt(accountId),
        categoryId: categoryId ? parseInt(categoryId) : null,
        notes: notes || null,
      },
      include: { category: true, account: true }
    });
    res.status(201).json(tx);
  } catch (error) { next(error); }
});

// PATCH /api/transactions/:id — update any field
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { date, description, amount, type, accountId, categoryId, notes } = req.body;

    const updateData = {};
    if (date        !== undefined) updateData.date        = new Date(date);
    if (description !== undefined) updateData.description = String(description).trim();
    if (amount      !== undefined) {
      updateData.amount = parseFloat(amount);
      if (type === undefined) updateData.type = updateData.amount >= 0 ? 'INCOME' : 'EXPENSE';
    }
    if (type        !== undefined) updateData.type        = type;
    if (accountId   !== undefined) updateData.accountId   = parseInt(accountId);
    if (categoryId  !== undefined) updateData.categoryId  = categoryId ? parseInt(categoryId) : null;
    if (notes       !== undefined) updateData.notes       = notes;

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
    await prisma.transaction.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

module.exports = router;
