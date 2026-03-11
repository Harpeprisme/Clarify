const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get budgets for a specific month
router.get('/', async (req, res, next) => {
  try {
    const { month } = req.query; // Format: YYYY-MM
    
    if (!month) {
      return res.status(400).json({ error: 'Month parameter (YYYY-MM) is required' });
    }

    const budgets = await prisma.budget.findMany({
      where: { month },
      include: { category: true }
    });

    res.json(budgets);
  } catch (error) {
    next(error);
  }
});

// Set or update a budget for a category and month
router.post('/', async (req, res, next) => {
  try {
    const { categoryId, amount, month } = req.body;
    
    if (!categoryId || amount === undefined || !month) {
      return res.status(400).json({ error: 'categoryId, amount, and month are required' });
    }

    const budget = await prisma.budget.upsert({
      where: {
        categoryId_month_userId: {
          categoryId: parseInt(categoryId),
          month,
          userId: 1 // Default user for now
        }
      },
      update: { amount: parseFloat(amount) },
      create: {
        categoryId: parseInt(categoryId),
        amount: parseFloat(amount),
        month,
        userId: 1 // Default user for now
      },
      include: { category: true }
    });

    res.json(budget);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
