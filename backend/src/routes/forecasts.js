/**
 * GET  /api/forecasts/recurring      → Detected recurring transactions
 * GET  /api/forecasts/projection     → End-of-month balance projection
 * PATCH /api/forecasts/recurring/:id → Confirm/deactivate/modify a recurring item
 * GET  /api/forecasts/settings       → Get forecast settings
 * PATCH /api/forecasts/settings      → Update forecast settings
 *
 * All GET endpoints accept: startDate, endDate, accountIds (global filters)
 */
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { detectRecurring } = require('../services/recurringDetector');
const { computeProjection, getSettings } = require('../services/forecastEngine');

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseAccountIds(req) {
  if (req.query.accountIds) return req.query.accountIds.split(',').map(Number).filter(Boolean);
  if (req.query.accountId) return [parseInt(req.query.accountId)].filter(Boolean);
  return [];
}

async function getValidAccountIds(userId, requestedIds) {
  const userAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const userAccountIds = userAccounts.map(a => a.id);
  return requestedIds.length > 0
    ? requestedIds.filter(id => userAccountIds.includes(id))
    : userAccountIds;
}

// ── GET /api/forecasts/recurring ─────────────────────────────────────────────
router.get('/recurring', async (req, res, next) => {
  try {
    const accountIds = parseAccountIds(req);
    const validAccountIds = await getValidAccountIds(req.user.id, accountIds);

    // Get user settings for detection parameters
    const settings = await getSettings(req.user.id);

    // Detect recurring from transaction history
    const detected = await detectRecurring(req.user.id, validAccountIds, {
      minOccurrences: settings.detectionMinOccurrences,
      amountTolerance: settings.detectionAmountTolerance,
      dayTolerance: settings.detectionDayTolerance,
    });

    // Load saved recurring transactions
    const saved = await prisma.recurringTransaction.findMany({
      where: { userId: req.user.id },
      include: { category: true },
    });

    // Merge: saved overrides detected with same normalized description
    const savedMap = new Map(saved.map(s => [s.description.toLowerCase(), s]));
    const merged = [];

    for (const d of detected) {
      const key = d.normalizedDescription.toLowerCase();
      if (savedMap.has(key)) {
        const s = savedMap.get(key);
        merged.push({
          ...d,
          id: s.id,
          isConfirmed: s.isConfirmed,
          isActive: s.isActive,
          isSaved: true,
        });
        savedMap.delete(key);
      } else {
        merged.push({
          ...d,
          id: null,
          isConfirmed: false,
          isActive: true,
          isSaved: false,
        });
      }
    }

    // Add saved ones not found in detection (manually confirmed)
    for (const s of savedMap.values()) {
      merged.push({
        id: s.id,
        description: s.description,
        normalizedDescription: s.description,
        averageAmount: s.averageAmount,
        frequency: s.frequency,
        nextExpectedDate: s.nextExpectedDate,
        lastSeenDate: s.lastSeenDate,
        occurrences: s.occurrences,
        confidence: s.confidence,
        isConfirmed: s.isConfirmed,
        isActive: s.isActive,
        isSaved: true,
        categoryId: s.categoryId,
        category: s.category,
      });
    }

    res.json(merged);
  } catch (err) { next(err); }
});

// ── GET /api/forecasts/projection ────────────────────────────────────────────
router.get('/projection', async (req, res, next) => {
  try {
    const accountIds = parseAccountIds(req);
    const validAccountIds = await getValidAccountIds(req.user.id, accountIds);
    const projection = await computeProjection(req.user.id, validAccountIds);
    res.json(projection);
  } catch (err) { next(err); }
});

// ── PATCH /api/forecasts/recurring/:id ───────────────────────────────────────
router.patch('/recurring/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { isConfirmed, isActive, averageAmount, frequency, description } = req.body;

    if (id) {
      // Update existing saved recurring
      const existing = await prisma.recurringTransaction.findFirst({
        where: { id, userId: req.user.id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Récurrence introuvable' });
      }

      const updateData = {};
      if (isConfirmed !== undefined) updateData.isConfirmed = Boolean(isConfirmed);
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (averageAmount !== undefined) updateData.averageAmount = parseFloat(averageAmount);
      if (frequency !== undefined) updateData.frequency = frequency;

      const updated = await prisma.recurringTransaction.update({
        where: { id },
        data: updateData,
        include: { category: true },
      });

      return res.json(updated);
    }

    // If no id, we're creating/confirming a newly detected one
    if (!description) {
      return res.status(400).json({ error: 'description requise pour confirmer une nouvelle récurrence' });
    }

    const created = await prisma.recurringTransaction.create({
      data: {
        userId: req.user.id,
        description: description,
        averageAmount: parseFloat(averageAmount || 0),
        frequency: frequency || 'MONTHLY',
        lastSeenDate: new Date(),
        isConfirmed: true,
        isActive: true,
        confidence: 100,
      },
      include: { category: true },
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// ── POST /api/forecasts/recurring/confirm ────────────────────────────────────
// Confirm a newly detected recurring (save it to DB)
router.post('/recurring/confirm', async (req, res, next) => {
  try {
    const { description, averageAmount, frequency, nextExpectedDate, lastSeenDate, occurrences, confidence, categoryId } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description requise' });
    }

    // Check if already exists
    const existing = await prisma.recurringTransaction.findFirst({
      where: { userId: req.user.id, description: description.toLowerCase() },
    });

    if (existing) {
      const updated = await prisma.recurringTransaction.update({
        where: { id: existing.id },
        data: { isConfirmed: true, isActive: true },
        include: { category: true },
      });
      return res.json(updated);
    }

    const created = await prisma.recurringTransaction.create({
      data: {
        userId: req.user.id,
        description: description.toLowerCase(),
        averageAmount: parseFloat(averageAmount || 0),
        frequency: frequency || 'MONTHLY',
        nextExpectedDate: nextExpectedDate ? new Date(nextExpectedDate) : null,
        lastSeenDate: lastSeenDate ? new Date(lastSeenDate) : new Date(),
        occurrences: occurrences || 0,
        confidence: confidence || 100,
        isConfirmed: true,
        isActive: true,
        categoryId: categoryId ? parseInt(categoryId) : null,
      },
      include: { category: true },
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// ── GET /api/forecasts/settings ──────────────────────────────────────────────
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getSettings(req.user.id);
    res.json(settings);
  } catch (err) { next(err); }
});

// ── PATCH /api/forecasts/settings ────────────────────────────────────────────
router.patch('/settings', async (req, res, next) => {
  try {
    const { monthlySalary, safetyBuffer, detectionMinOccurrences, detectionAmountTolerance, detectionDayTolerance } = req.body;

    const updateData = {};
    if (monthlySalary !== undefined) updateData.monthlySalary = monthlySalary === null ? null : parseFloat(monthlySalary);
    if (safetyBuffer !== undefined) updateData.safetyBuffer = parseFloat(safetyBuffer);
    if (detectionMinOccurrences !== undefined) updateData.detectionMinOccurrences = parseInt(detectionMinOccurrences);
    if (detectionAmountTolerance !== undefined) updateData.detectionAmountTolerance = parseFloat(detectionAmountTolerance);
    if (detectionDayTolerance !== undefined) updateData.detectionDayTolerance = parseInt(detectionDayTolerance);

    // Upsert: create if not exists
    const settings = await prisma.forecastSettings.upsert({
      where: { userId: req.user.id },
      update: updateData,
      create: { userId: req.user.id, ...updateData },
    });

    res.json(settings);
  } catch (err) { next(err); }
});

module.exports = router;
