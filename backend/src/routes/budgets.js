const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get global budgets
router.get('/', async (req, res, next) => {
  try {
    const budgets = await prisma.budget.findMany({
      where: { month: 'GLOBAL', userId: req.user.id },
      include: { category: true }
    });

    res.json(budgets);
  } catch (error) {
    next(error);
  }
});

// Set or update a global category budget
router.post('/', async (req, res, next) => {
  try {
    const { categoryId, amount } = req.body;
    
    if (!categoryId || amount === undefined) {
      return res.status(400).json({ error: 'categoryId and amount are required' });
    }

    const budget = await prisma.budget.upsert({
      where: {
        categoryId_month_userId: {
          categoryId: parseInt(categoryId),
          month: 'GLOBAL',
          userId: req.user.id
        }
      },
      update: { amount: parseFloat(amount) },
      create: {
        categoryId: parseInt(categoryId),
        amount: parseFloat(amount),
        month: 'GLOBAL',
        userId: req.user.id
      },
      include: { category: true }
    });

    res.json(budget);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
