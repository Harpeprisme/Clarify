const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get all rules
router.get('/', async (req, res, next) => {
  try {
    const rules = await prisma.categoryRule.findMany({
      include: { category: true },
      orderBy: { keyword: 'asc' }
    });
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

// Create a new rule
router.post('/', async (req, res, next) => {
  try {
    const { keyword, categoryId, priority } = req.body;
    
    if (!keyword || !categoryId) {
      return res.status(400).json({ error: 'Keyword and categoryId are required' });
    }

    const rule = await prisma.categoryRule.create({
      data: {
        keyword: keyword.toLowerCase(),
        categoryId: parseInt(categoryId),
        priority: priority || 0
      },
      include: { category: true }
    });

    res.status(201).json(rule);
  } catch (error) {
    next(error);
  }
});

// Delete a rule
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.categoryRule.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
