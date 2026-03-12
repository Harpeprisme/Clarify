const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { requireAdmin } = require('../middleware/auth');

const SALT_ROUNDS = 12;

// Apply requireAdmin to ALL routes in this file
router.use(requireAdmin);

// ── GET ALL USERS ────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true, avatarUrl: true, googleId: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// ── CREATE USER ──────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role || 'READER'
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// ── UPDATE USER (Role, Name, etc.) ──────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, role, email } = req.body;

    // Prevent self-demotion or self-deletion if needed (optional but recommended)
    // if (id === req.user.id && role && role !== 'ADMIN') {
    //   return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre rôle admin' });
    // }

    const user = await prisma.user.update({
      where: { id },
      data: { 
        ...(name && { name }), 
        ...(role && { role }),
        ...(email && { email })
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// ── DELETE USER ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte depuis cet écran' });
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
