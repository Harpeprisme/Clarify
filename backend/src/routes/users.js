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

    // Create user WITHOUT a password — they'll set it via the email link
    const user = await prisma.user.create({
      data: { name, email, role: role || 'READER', mustChangePassword: true, isEmailVerified: true },
      select: { id: true, name: true, email: true, role: true }
    });

    // Generate a password reset token so they can set their password
    const crypto = require('crypto');
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours for first setup

    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

    const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const setupUrl = `${APP_URL}/reset-password?token=${token}`;

    // Send welcome email with the setup link (non-blocking)
    const { sendWelcomeEmail } = require('../services/emailService');
    sendWelcomeEmail({ name, email, setupUrl }).catch(e => console.error('[Email] Welcome failed:', e.message));

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
