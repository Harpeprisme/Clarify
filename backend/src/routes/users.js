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
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nom et email requis' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    // Generate a random temp password
    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(6).toString('base64url'); // ~8 chars, url-safe
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: role || 'READER' },
      select: { id: true, name: true, email: true, role: true }
    });

    // Send welcome email with temp password (non-blocking)
    const { sendWelcomeEmail } = require('../services/emailService');
    sendWelcomeEmail({ name, email, tempPassword }).catch(e => console.error('[Email] Welcome failed:', e.message));

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

    // Fetch the target user to check if they are the super-admin
    const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });

    // Hard protection: admin@clarify.app is ALWAYS ADMIN — role can never be changed
    const effectiveRole = (target?.email === 'admin@clarify.app') ? 'ADMIN' : role;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(effectiveRole && { role: effectiveRole }),
        ...(email && target?.email !== 'admin@clarify.app' && { email })
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
