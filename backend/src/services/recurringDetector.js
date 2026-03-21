/**
 * recurringDetector.js
 * Detects recurring transactions (subscriptions, salary, etc.) from transaction history.
 *
 * Algorithm:
 * 1. Group transactions by normalized description
 * 2. For each group with >= minOccurrences, check if amounts are similar (tolerance %)
 * 3. Compute average interval between occurrences
 * 4. Classify frequency (WEEKLY ~7d, MONTHLY ~30d, QUARTERLY ~90d, ANNUAL ~365d)
 * 5. Compute confidence score based on regularity
 */
const prisma = require('../config/prisma');

/**
 * Normalize description for grouping (reuses logic from categorizer)
 */
function normalizeDesc(raw) {
  return raw
    .toLowerCase()
    .replace(/^(cb\s*|vir(ement)?\s*|prlv(mt)?\s*|sepa\s*|carte\s*|ret(rait)?\s*|achat\s*|paiement\s*|facture\s*|avoir\s*|prelevement\s*|prelev\s*|rembt?\s*|rem\s*)/i, '')
    .replace(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g, '')
    .replace(/\b\d{8}\b/g, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/\d+[.,]\d{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Frequency classification based on average interval in days
 */
function classifyFrequency(avgIntervalDays) {
  if (avgIntervalDays <= 10) return 'WEEKLY';
  if (avgIntervalDays <= 45) return 'MONTHLY';
  if (avgIntervalDays <= 120) return 'QUARTERLY';
  return 'ANNUAL';
}

/**
 * Compute confidence score (0-100) based on:
 * - Number of occurrences (more = higher)
 * - Interval regularity (standard deviation vs mean)
 * - Amount consistency
 */
function computeConfidence(occurrences, intervals, amounts) {
  let score = 0;

  // Occurrence bonus: 2 → 30, 3 → 50, 4 → 60, 5+ → 70
  score += Math.min(70, 20 + occurrences * 10);

  // Interval regularity (0-20 points)
  if (intervals.length >= 1) {
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1; // Coefficient of variation
    // cv < 0.1 = very regular → 20pts, cv > 0.5 = irregular → 0pts
    score += Math.max(0, Math.round(20 * (1 - cv * 2)));
  }

  // Amount consistency (0-10 points)
  if (amounts.length >= 2) {
    const meanAmt = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const maxDev = Math.max(...amounts.map(a => Math.abs(a - meanAmt)));
    const relDev = meanAmt !== 0 ? maxDev / Math.abs(meanAmt) : 1;
    score += relDev < 0.05 ? 10 : relDev < 0.15 ? 7 : relDev < 0.30 ? 3 : 0;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Main detection function.
 * Analyzes transactions and returns detected recurring patterns.
 * 
 * @param {number} userId
 * @param {number[]} accountIds - account IDs to analyze
 * @param {object} settings - detection parameters
 * @returns {Array} detected recurring transactions
 */
async function detectRecurring(userId, accountIds, settings = {}) {
  const {
    minOccurrences = 2,
    amountTolerance = 15,  // percent
    dayTolerance = 5,
  } = settings;

  // Fetch all transactions for the user's selected accounts (last 12 months minimum)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const where = {
    account: { userId },
    isInternal: false,
  };
  if (accountIds && accountIds.length > 0) {
    where.accountId = { in: accountIds };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'asc' },
    include: { category: true },
  });

  // Group by normalized description
  const groups = {};
  for (const tx of transactions) {
    const key = normalizeDesc(tx.description);
    if (!key || key.length < 3) continue; // Skip very short/empty keys
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  const detected = [];

  for (const [descKey, txs] of Object.entries(groups)) {
    if (txs.length < minOccurrences) continue;

    // Check amount consistency
    const amounts = txs.map(t => t.amount);
    const meanAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length;

    // Filter out transactions too far from the mean amount
    const toleranceAbs = Math.abs(meanAmount) * (amountTolerance / 100);
    const consistent = txs.filter(t => Math.abs(t.amount - meanAmount) <= toleranceAbs);
    if (consistent.length < minOccurrences) continue;

    // Compute intervals between consecutive transactions
    const sortedDates = consistent.map(t => new Date(t.date).getTime()).sort();
    const intervals = [];
    for (let i = 1; i < sortedDates.length; i++) {
      intervals.push((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24));
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;

    // Check regularity: average interval should be reasonable (5-400 days)
    if (avgInterval < 5 || avgInterval > 400) continue;

    // Check that intervals are somewhat consistent
    const maxDeviation = dayTolerance + avgInterval * 0.3; // Allow 30% + tolerance
    const regularIntervals = intervals.filter(i => Math.abs(i - avgInterval) <= maxDeviation);
    if (regularIntervals.length < intervals.length * 0.5) continue; // At least 50% must be regular

    const frequency = classifyFrequency(avgInterval);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    const nextExpected = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
    const consistentAmounts = consistent.map(t => t.amount);
    const confidence = computeConfidence(consistent.length, intervals, consistentAmounts);

    // Use the most common category
    const catCounts = {};
    for (const t of consistent) {
      if (t.categoryId) {
        catCounts[t.categoryId] = (catCounts[t.categoryId] || 0) + 1;
      }
    }
    const topCategoryId = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    detected.push({
      description: consistent[0].description, // Original description from first occurrence
      normalizedDescription: descKey,
      averageAmount: parseFloat(meanAmount.toFixed(2)),
      frequency,
      nextExpectedDate: nextExpected,
      lastSeenDate: lastDate,
      occurrences: consistent.length,
      confidence,
      categoryId: topCategoryId ? parseInt(topCategoryId) : null,
      category: topCategoryId ? consistent.find(t => t.categoryId === parseInt(topCategoryId))?.category : null,
    });
  }

  // Sort by confidence descending, then by absolute amount
  detected.sort((a, b) => b.confidence - a.confidence || Math.abs(b.averageAmount) - Math.abs(a.averageAmount));

  return detected;
}

module.exports = { detectRecurring, normalizeDesc };
