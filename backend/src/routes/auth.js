const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const prisma  = require('../config/prisma');
const passport = require('../config/passport');
const { authenticate } = require('../middleware/auth');
const { authLimiter, createAccountLimiter, resetLimiter } = require('../middleware/security');

// Helper to reliably get the frontend URL, defaulting to the production URL if in prod
const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://deployclarify.vercel.app' : 'http://localhost:5173');
};

// In-memory failed login tracker (IP + email)
const failedAttempts = new Map();
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const SALT_ROUNDS = 12;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const PWD_ERR_MSG = "Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.";

// Session timeout in seconds (env var in ms, default 10 min = 600000ms)
const SESSION_TIMEOUT_SEC = Math.floor(parseInt(process.env.SESSION_TIMEOUT || '600000', 10) / 1000);

/** Generate a signed JWT for a user */
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'temporary_dev_secret_change_me_in_prod', { expiresIn: `${SESSION_TIMEOUT_SEC}s` });

// ── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', createAccountLimiter, async (req, res, next) => {
  try {
    let { name, email } = req.body;

    if (!name || !email)
      return res.status(400).json({ error: 'Nom et email requis' });

    email = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ error: 'Un compte avec cet email existe déjà' });

    // Force ADMIN role for specific email or first user
    const count = await prisma.user.count();
    const role  = (email === 'admin@clarify.app' || count === 0) ? 'ADMIN' : 'READER';

    const user = await prisma.user.create({
      data: { name, email, role, mustChangePassword: true },
      select: { id: true, name: true, email: true, role: true }
    });

    // Generate a password setup token (24h validity)
    const crypto = require('crypto');
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

    const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const setupUrl = `${APP_URL}/reset-password?token=${token}`;

    const { sendWelcomeEmail } = require('../services/emailService');
    sendWelcomeEmail({ name, email, setupUrl }).catch(e => console.error('[Email] Welcome failed:', e.message));

    res.status(201).json({ success: true, message: 'Compte créé ! Vérifiez votre boîte mail pour définir votre mot de passe.' });
  } catch (err) { next(err); }
});

// ── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    let { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    email = email.trim().toLowerCase();

    // Check account lockout
    const key = `${req.ip}_${email}`;
    const attempts = failedAttempts.get(key);
    if (attempts && attempts.count >= MAX_FAILED && (Date.now() - attempts.lastAttempt) < LOCKOUT_MS) {
      const remaining = Math.ceil((LOCKOUT_MS - (Date.now() - attempts.lastAttempt)) / 60000);
      return res.status(429).json({ error: `Compte temporairement verrouillé. Réessayez dans ${remaining} minute(s).` });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      const prev = failedAttempts.get(key) || { count: 0 };
      failedAttempts.set(key, { count: prev.count + 1, lastAttempt: Date.now() });
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const prev = failedAttempts.get(key) || { count: 0 };
      failedAttempts.set(key, { count: prev.count + 1, lastAttempt: Date.now() });
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Success — clear failed attempts
    failedAttempts.delete(key);

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl, googleId: user.googleId, isEmailVerified: user.isEmailVerified, mustChangePassword: !!user.mustChangePassword };
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

    if (!newPassword || !PASSWORD_REGEX.test(newPassword))
      return res.status(400).json({ error: PWD_ERR_MSG });

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
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash, mustChangePassword: false } });

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
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, googleId: true, isEmailVerified: true }
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
router.get('/google', (req, res, next) => {
  console.log('Initiating Google OAuth flow...');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  console.log('Received Google OAuth callback');
  const frontendUrl = getFrontendUrl();
  passport.authenticate('google', { session: false, failureRedirect: `${frontendUrl}/login?error=google_failed` }, (err, user, info) => {
    if (err) {
      console.error('Google OAuth Authentication Error:', err);
      return res.redirect(`${frontendUrl}/login?error=google_auth_error`);
    }
    if (!user) {
      console.warn('Google OAuth failed: No user found/created', info);
      return res.redirect(`${frontendUrl}/login?error=google_failed`);
    }

    console.log('Google OAuth Success for user:', user.email);
    const token = signToken(user.id);
    const safeUser = JSON.stringify({
      id: user.id, name: user.name, email: user.email,
      role: user.role, avatarUrl: user.avatarUrl, googleId: user.googleId
    });
    
    const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(safeUser)}`;
    console.log('Redirecting to frontend:', redirectUrl.substring(0, 100) + '...');
    res.redirect(redirectUrl);
  })(req, res, next);
});

// ── FORGOT PASSWORD ──────────────────────────────────────────────────────────
router.post('/forgot-password', resetLimiter, async (req, res, next) => {
  try {
    let { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    email = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to avoid email enumeration
    if (!user) return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });

    // Invalidate any existing token for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true }
    });

    // Generate secure token
    const crypto = require('crypto');
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

    const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    const { sendPasswordResetEmail } = require('../services/emailService');
    await sendPasswordResetEmail({ name: user.name, email: user.email, resetUrl });

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
  } catch (err) { next(err); }
});

// ── RESET PASSWORD ───────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis' });
    if (!PASSWORD_REGEX.test(password)) return res.status(400).json({ error: PWD_ERR_MSG });

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record || record.used || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Lien invalide ou expiré. Faites une nouvelle demande.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash, mustChangePassword: false } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } })
    ]);

    res.json({ message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) { next(err); }
});

// ── VERIFY EMAIL ─────────────────────────────────────────────────────────────
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });
    if (!user) return res.status(400).json({ error: 'Token invalide ou expiré' });

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerificationToken: null },
      select: { id: true, name: true, email: true, role: true, isEmailVerified: true }
    });

    res.json({ message: 'Email vérifié avec succès', user: verifiedUser });
  } catch(err) { next(err); }
});

// ── RESEND VERIFICATION ──────────────────────────────────────────────────────
router.post('/resend-verification', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.isEmailVerified) return res.status(400).json({ error: 'Email déjà vérifié' });

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: token }
    });

    const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
    const { sendVerificationEmail } = require('../services/emailService');
    await sendVerificationEmail({ name: user.name, email: user.email, verifyUrl });

    res.json({ message: 'Email de vérification renvoyé' });
  } catch(err) { next(err); }
});

module.exports = router;
