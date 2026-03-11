const prisma = require('../config/prisma');

/**
 * Detect internal transfers (same amount, opposite sign, within 3 days)
 */
const detectInternalTransfers = async () => {
  // Find all unassigned transfers
  const potentialTransfers = await prisma.transaction.findMany({
    where: {
      type: { in: ['INCOME', 'EXPENSE'] },
      isInternal: false
    },
    orderBy: { date: 'asc' }
  });

  let matchedIds = new Set();
  let updates = [];

  for (let i = 0; i < potentialTransfers.length; i++) {
    const t1 = potentialTransfers[i];
    if (matchedIds.has(t1.id)) continue;

    for (let j = i + 1; j < potentialTransfers.length; j++) {
      const t2 = potentialTransfers[j];
      if (matchedIds.has(t2.id)) continue;

      // Check if amounts are opposite
      if (Math.abs(t1.amount) === Math.abs(t2.amount) && Math.sign(t1.amount) !== Math.sign(t2.amount)) {
        // Different accounts
        if (t1.accountId !== t2.accountId) {
          // Date difference within 3 days
          const dateDiff = Math.abs(new Date(t1.date) - new Date(t2.date)) / (1000 * 60 * 60 * 24);
          
          if (dateDiff <= 3) {
            matchedIds.add(t1.id);
            matchedIds.add(t2.id);
            updates.push(t1.id, t2.id);
            break; // Move to next t1
          }
        }
      }
    }
  }

  if (updates.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: updates } },
      data: { 
        isInternal: true,
        type: 'TRANSFER'
      }
    });
  }

  return updates.length / 2; // Return number of transfer pairs found
};

module.exports = { detectInternalTransfers };
