const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const prisma  = require('../config/prisma');
const passport = require('../config/passport');
const { authenticate } = require('../middleware/auth');

const SALT_ROUNDS = 12;

/** Generate a signed JWT for a user */
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'temporary_dev_secret_change_me_in_prod', { expiresIn: '7d' });

// ── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nom, email et mot de passe requis' });

    if (password.length < 8)
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ error: 'Un compte avec cet email existe déjà' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // First user created is always ADMIN
    const count = await prisma.user.count();
    const role  = count === 0 ? 'ADMIN' : 'READER';

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true }
    });

    res.status(201).json({ token: signToken(user.id), user });
  } catch (err) { next(err); }
});

// ── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash)
      return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ error: 'Identifiants invalides' });

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl, googleId: user.googleId };
    res.json({ token: signToken(user.id), user: safeUser });
  } catch (err) { next(err); }
});

// ── ME (current user) ────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json(req.user);
});

// ── CHANGE PASSWORD ──────────────────────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // If user has a password, verify current one
    if (user.passwordHash) {
      if (!currentPassword)
        return res.status(400).json({ error: 'Ancien mot de passe requis' });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid)
        return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (err) { next(err); }
});

// ── UPDATE PROFILE ───────────────────────────────────────────────────────────
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ error: 'Le nom ne peut pas être vide' });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, googleId: true }
    });

    res.json(user);
  } catch (err) { next(err); }
});

// ── DELETE ACCOUNT ───────────────────────────────────────────────────────────
router.delete('/account', authenticate, async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── GOOGLE OAUTH ─────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed` }),
  (req, res) => {
    const token = signToken(req.user.id);
    const user  = JSON.stringify({
      id: req.user.id, name: req.user.name, email: req.user.email,
      role: req.user.role, avatarUrl: req.user.avatarUrl, googleId: req.user.googleId
    });
    // Redirect to frontend with token in URL so it can store it
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(user)}`);
  }
);

module.exports = router;
