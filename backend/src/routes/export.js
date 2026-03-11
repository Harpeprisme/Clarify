const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { stringify } = require('papaparse');

// Export all transactions to enriched CSV
router.get('/', async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      include: {
        account: true,
        category: true
      }
    });

    const dataRows = transactions.map(t => ({
      Date: t.date.toISOString().split('T')[0],
      Description: t.description,
      Montant: t.amount,
      Type: t.type,
      Compte: t.account ? t.account.name : '',
      Catégorie: t.category ? t.category.name : '',
      'Notes perso': t.notes || ''
    }));

    const csvStr = stringify(dataRows, {
      header: true,
      delimiter: ';'
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=openbank_export.csv');
    res.status(200).send(csvStr);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
