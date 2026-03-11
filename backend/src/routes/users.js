const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// User CRUD operations
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Simplification for MVP: store raw password (if required, add bcrypt)
    // Here we're using a dummy hash for quick local usage
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: '$2a$10$dummyHashToImplementLater',
        role: role || 'READER'
      },
      select: { id: true, name: true, email: true, role: true }
    });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
