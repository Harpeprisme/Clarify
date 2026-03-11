const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get all categories (Global defaults OR user-specific)
router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { userId: null },        // System defaults
          { userId: req.user.id }  // User-specific
        ]
      },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Create custom category
router.post('/', async (req, res, next) => {
  try {
    const { name, color, icon } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        color: color || '#6B7280',
        icon: icon || 'tag',
        isDefault: false,
        userId: req.user.id
      }
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// Update category
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, color, icon } = req.body;
    
    // Verify ownership
    const existing = await prisma.category.findFirst({ 
      where: { id, userId: req.user.id } 
    });
    
    if (!existing) {
      // If it's a default category, users can't modify it generally
      const isDefault = await prisma.category.findFirst({ where: { id, isDefault: true } });
      if (isDefault) return res.status(403).json({ error: 'Cannot modify default categories' });
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: existing.isDefault ? existing.name : name,
        color,
        icon
      }
    });

    res.json(category);
  } catch (error) {
    next(error);
  }
});

// Delete category (cannot delete defaults, reassign transactions to 'Autres')
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    
    if (category.isDefault) {
      return res.status(403).json({ error: 'Cannot delete default categories' });
    }

    // Find "Autres" category
    const defaultCat = await prisma.category.findFirst({ where: { name: 'Autres' } });
    
    // Reassign transactions
    if (defaultCat) {
      await prisma.transaction.updateMany({
        where: { categoryId: id },
        data: { categoryId: defaultCat.id }
      });
    }

    // Delete related rules
    await prisma.categoryRule.deleteMany({ where: { categoryId: id } });
    
    // Delete budget
    await prisma.budget.deleteMany({ where: { categoryId: id } });

    // Delete category
    await prisma.category.delete({ where: { id } });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
