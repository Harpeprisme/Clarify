const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../config/prisma');
const { parseCSV, detectFormat } = require('../services/csvParser');
const { categorizeTransaction } = require('../services/categorizer');
const { detectInternalTransfers } = require('../services/transferDetector');

// Configure multer for memory storage (limit: 20MB)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

/**
 * POST /api/import/detect
 * Detect CSV format and return a preview without importing anything.
 */
router.post('/detect', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const detected = await detectFormat(req.file.buffer);
    res.json(detected);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/import
 * Full CSV import: parse, categorize, detect transfers, persist.
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const accountId = parseInt(req.body.accountId);
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    // Verify account exists AND belongs to user
    const account = await prisma.account.findFirst({ 
      where: { id: accountId, userId: req.user.id } 
    });
    if (!account) {
      return res.status(404).json({ error: 'Compte introuvable ou accès refusé' });
    }

    // Parse CSV — pass buffer directly for encoding auto-detection
    const rows = await parseCSV(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({ 
        error: 'Aucune transaction trouvée dans ce fichier. Vérifiez le format du CSV (colonnes Date, Libellé, Montant attendus).' 
      });
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Process rows sequentially
    for (const row of rows) {
      // Duplicate check: same date + description + amount + account
      const existing = await prisma.transaction.findFirst({
        where: {
          accountId,
          date: new Date(row.date),
          amount: row.amount,
          description: row.description
        }
      });

      if (!existing) {
        const category = await categorizeTransaction(row.description, row.amount, req.user.id);
        console.log(`[Import] Categorizing "${row.description}" [${row.amount}] -> ${category ? category.name : 'NONE'}`);

        await prisma.transaction.create({
          data: {
            date: new Date(row.date),
            description: row.description,
            amount: row.amount,
            type: row.type,
            accountId,
            categoryId: category ? category.id : null,
          }
        });
        importedCount++;
      } else {
        skippedCount++;
      }
    }

    // Log import history
    await prisma.importHistory.create({
      data: {
        filename: req.file.originalname,
        accountId,
        rowCount: importedCount
      }
    });

    // Detect and flag internal transfers (scoped to user accounts only)
    const transfersDetected = await detectInternalTransfers(req.user.id);

    // If the user provided a target currentBalance, adjust the account's initialBalance now
    // so that initialBalance + sum(all_transactions) = currentBalance
    const targetBalance = req.body.currentBalance;
    if (targetBalance !== undefined && targetBalance !== '') {
      const txRes = await prisma.transaction.aggregate({
        where: { accountId },
        _sum: { amount: true },
      });
      const txSum = txRes._sum.amount || 0;
      await prisma.account.update({
        where: { id: accountId },
        data: { initialBalance: parseFloat(targetBalance) - txSum }
      });
    }

    res.json({
      message: 'Import successful',
      rowsFound: rows.length,
      rowsImported: importedCount,
      rowsSkipped: skippedCount,
      transfersDetected,
      accountId
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
