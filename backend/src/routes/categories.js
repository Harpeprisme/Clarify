const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get all categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
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
        color: color || '#6B7280', // Default Gray
        icon: icon || 'tag',
        isDefault: false
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
    
    // Check if default category (prevent name changes on defaults)
    const existing = await prisma.category.findUnique({ where: { id } });
    
    if (existing.isDefault && name && name !== existing.name) {
      return res.status(403).json({ error: 'Cannot rename default categories' });
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
