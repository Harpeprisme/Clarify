const express = require('express');
const router  = express.Router();
const prisma  = require('../config/prisma');

// All endpoints rely on the user being authenticated (enforced by index.js auth middleware)
// But we also need to enforce ADMIN role for modifying. Reading is public.

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé. Rôle ADMIN requis.' });
  }
};

// ── GET all account types (Public for all users to create accounts) ──────────
router.get('/', async (req, res, next) => {
  try {
    const types = await prisma.accountType.findMany({
      orderBy: { group: 'asc' } // or ID
    });
    res.json(types);
  } catch (err) { next(err); }
});

// ── POST (Create) account type (Admin only) ──────────────────────────────────
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    let { id, name, group } = req.body;
    if (!id || !name || !group) {
      return res.status(400).json({ error: 'id, name et group sont requis' });
    }

    // Optional: format ID
    id = id.toUpperCase().replace(/\s+/g, '_');

    const existing = await prisma.accountType.findUnique({ where: { id } });
    if (existing) return res.status(409).json({ error: 'Ce type de compte existe déjà.' });

    const newType = await prisma.accountType.create({
      data: { id, name: name.trim(), group: group.trim() }
    });

    res.status(201).json(newType);
  } catch (err) { next(err); }
});

// ── PATCH (Update) account type (Admin only) ─────────────────────────────────
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    const { name, group } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (group) data.group = group.trim();

    const existing = await prisma.accountType.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Type de compte introuvable.' });

    const updated = await prisma.accountType.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE account type (Admin only) ─────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    // Cannot delete if there are accounts using it
    const accountsUsingCount = await prisma.account.count({ where: { type: id } });
    if (accountsUsingCount > 0) {
      return res.status(400).json({ error: `Impossible de supprimer : ${accountsUsingCount} compte(s) utilisent ce type.` });
    }

    await prisma.accountType.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
