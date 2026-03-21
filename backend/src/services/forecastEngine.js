/**
 * forecastEngine.js
 * Projects end-of-month balance based on:
 *  - Current balance (from accounts)
 *  - Detected recurring transactions (income + expenses)
 *  - Historical variable spending
 *  - User-configured settings (salary override, safety buffer)
 */
const prisma = require('../config/prisma');
const { detectRecurring } = require('./recurringDetector');

/**
 * Get the user's forecast settings (create defaults if not exists)
 */
async function getSettings(userId) {
  let settings = await prisma.forecastSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.forecastSettings.create({
      data: { userId },
    });
  }
  return settings;
}

/**
 * Compute current balance for selected accounts
 */
async function getCurrentBalance(userId, accountIds) {
  const accounts = await prisma.account.findMany({
    where: { userId },
  });

  const selected = accountIds && accountIds.length > 0
    ? accounts.filter(a => accountIds.includes(a.id))
    : accounts;

  let totalBalance = 0;
  for (const acc of selected) {
    const txSum = await prisma.transaction.aggregate({
      where: { accountId: acc.id },
      _sum: { amount: true },
    });
    totalBalance += acc.initialBalance + (txSum._sum.amount || 0);
  }

  return totalBalance;
}

/**
 * Compute average monthly variable expenses (non-recurring) over the last N months
 */
async function getAverageVariableExpenses(userId, accountIds, recurringDescriptions, months = 3) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const where = {
    account: { userId },
    type: 'EXPENSE',
    isInternal: false,
    date: { gte: since },
  };
  if (accountIds && accountIds.length > 0) {
    where.accountId = { in: accountIds };
  }

  const expenses = await prisma.transaction.findMany({
    where,
    select: { amount: true, description: true },
  });

  // Subtract recurring expenses to get variable expenses only
  const normalizeDesc = require('./recurringDetector').normalizeDesc;
  const recurringSet = new Set(recurringDescriptions.map(d => normalizeDesc(d)));

  let variableTotal = 0;
  for (const exp of expenses) {
    const norm = normalizeDesc(exp.description);
    if (!recurringSet.has(norm)) {
      variableTotal += Math.abs(exp.amount);
    }
  }

  return variableTotal / Math.max(1, months);
}

/**
 * Main projection function
 * 
 * @param {number} userId
 * @param {number[]} accountIds - filter by account IDs (empty = all)
 * @returns {object} Complete forecast projection
 */
async function computeProjection(userId, accountIds = []) {
  const settings = await getSettings(userId);

  // 1. Get valid account IDs
  const userAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const userAccountIds = userAccounts.map(a => a.id);
  const validAccountIds = accountIds.length > 0
    ? accountIds.filter(id => userAccountIds.includes(id))
    : userAccountIds;

  // 2. Current balance
  const currentBalance = await getCurrentBalance(userId, validAccountIds);

  // 3. Detect recurring transactions
  const detected = await detectRecurring(userId, validAccountIds, {
    minOccurrences: settings.detectionMinOccurrences,
    amountTolerance: settings.detectionAmountTolerance,
    dayTolerance: settings.detectionDayTolerance,
  });

  // 4. Load confirmed recurring transactions from DB
  const saved = await prisma.recurringTransaction.findMany({
    where: { userId, isActive: true },
    include: { category: true },
  });

  // Merge: saved ones take priority, add newly detected ones
  const mergedRecurring = [...saved];
  const savedDescs = new Set(saved.map(s => s.description.toLowerCase()));
  for (const d of detected) {
    if (!savedDescs.has(d.normalizedDescription.toLowerCase())) {
      mergedRecurring.push({
        ...d,
        isConfirmed: false,
        isActive: true,
        isSaved: false,
      });
    }
  }

  // 5. Classify recurring into income vs expenses
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
  const daysRemaining = Math.max(0, Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24)));

  // Separate into income and expense recurring items
  const recurringExpenses = mergedRecurring.filter(r => r.averageAmount < 0);
  const recurringIncome = mergedRecurring.filter(r => r.averageAmount > 0);

  // 6. Determine which recurring items are still expected this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Check which recurring payments have already happened this month
  const thisMonthTxs = await prisma.transaction.findMany({
    where: {
      account: { userId },
      accountId: { in: validAccountIds },
      isInternal: false,
      date: { gte: monthStart, lte: endOfMonth },
    },
    select: { description: true, amount: true },
  });

  const normalizeDesc = require('./recurringDetector').normalizeDesc;
  const thisMonthNormalized = new Set(thisMonthTxs.map(t => normalizeDesc(t.description)));

  const recurringPending = [];
  const recurringPaid = [];
  const incomeExpected = [];
  const incomeReceived = [];

  for (const r of recurringExpenses) {
    const norm = r.normalizedDescription || normalizeDesc(r.description);
    if (thisMonthNormalized.has(norm)) {
      recurringPaid.push(r);
    } else if (r.frequency === 'MONTHLY' || 
               (r.nextExpectedDate && new Date(r.nextExpectedDate) <= endOfMonth)) {
      recurringPending.push(r);
    }
  }

  for (const r of recurringIncome) {
    const norm = r.normalizedDescription || normalizeDesc(r.description);
    if (thisMonthNormalized.has(norm)) {
      incomeReceived.push(r);
    } else if (r.frequency === 'MONTHLY' ||
               (r.nextExpectedDate && new Date(r.nextExpectedDate) <= endOfMonth)) {
      incomeExpected.push(r);
    }
  }

  // 7. Calculate expected amounts
  const expectedRecurringExpenses = recurringPending.reduce((s, r) => s + r.averageAmount, 0);
  
  // Use salary override if set, otherwise use detected recurring income
  let expectedIncome = 0;
  if (settings.monthlySalary != null && settings.monthlySalary > 0) {
    // Check if salary already received this month
    const alreadyReceivedIncome = incomeReceived.reduce((s, r) => s + r.averageAmount, 0);
    if (alreadyReceivedIncome < settings.monthlySalary * 0.5) {
      expectedIncome = settings.monthlySalary;
    }
  } else {
    expectedIncome = incomeExpected.reduce((s, r) => s + r.averageAmount, 0);
  }

  // 8. Estimate variable expenses
  const recurringDescs = mergedRecurring.map(r => r.description);
  const avgVariableMonthly = await getAverageVariableExpenses(userId, validAccountIds, recurringDescs);
  
  // Pro-rate variable expenses for remaining days
  const daysInMonth = endOfMonth.getDate();
  const estimatedVariableExpenses = -(avgVariableMonthly * (daysRemaining / daysInMonth));

  // 9. Projected balance
  const projectedBalance = currentBalance + expectedIncome + expectedRecurringExpenses + estimatedVariableExpenses;
  const savingsPotential = Math.max(0, projectedBalance - settings.safetyBuffer);

  // 10. Generate alerts
  const alerts = [];
  if (recurringIncome.length === 0 && (!settings.monthlySalary || settings.monthlySalary <= 0)) {
    alerts.push({ type: 'WARNING', message: 'Aucun revenu récurrent détecté. Configurez votre salaire dans les paramètres.' });
  }
  if (projectedBalance < 0) {
    alerts.push({ type: 'DANGER', message: `Attention : solde projeté négatif (${projectedBalance.toFixed(2)}€) en fin de mois.` });
  }
  if (projectedBalance < settings.safetyBuffer && projectedBalance >= 0) {
    alerts.push({ type: 'WARNING', message: `Le solde projeté est en dessous du coussin de sécurité de ${settings.safetyBuffer}€.` });
  }

  const totalRecurringMonthly = recurringExpenses.reduce((s, r) => s + Math.abs(r.averageAmount), 0);
  if (totalRecurringMonthly > 0) {
    alerts.push({ 
      type: 'INFO', 
      message: `Vos abonnements représentent ${totalRecurringMonthly.toFixed(2)}€/mois (${(totalRecurringMonthly * 12).toFixed(0)}€/an).` 
    });
  }

  return {
    currentBalance: parseFloat(currentBalance.toFixed(2)),
    projectedBalance: parseFloat(projectedBalance.toFixed(2)),
    projectedDate: endOfMonth.toISOString().slice(0, 10),
    daysRemaining,
    expectedIncome: parseFloat(expectedIncome.toFixed(2)),
    expectedRecurringExpenses: parseFloat(expectedRecurringExpenses.toFixed(2)),
    estimatedVariableExpenses: parseFloat(estimatedVariableExpenses.toFixed(2)),
    savingsPotential: parseFloat(savingsPotential.toFixed(2)),
    totalRecurringMonthly: parseFloat(totalRecurringMonthly.toFixed(2)),
    breakdown: {
      recurringPending,
      recurringPaid,
      incomeExpected,
      incomeReceived,
    },
    alerts,
    settings: {
      safetyBuffer: settings.safetyBuffer,
      monthlySalary: settings.monthlySalary,
    },
  };
}

module.exports = { computeProjection, getSettings };
