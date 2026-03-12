const cron = require('node-cron');
const prisma = require('../config/prisma');
const { sendDailyDigestEmail } = require('../services/emailService');

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

/**
 * Daily digest cron job — runs every day at 8:00 AM server time.
 * Sends each user with at least one account their financial summary.
 */
function startDailyDigest() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] 📧 Starting daily digest...');

    const users = await prisma.user.findMany({
      where: { accounts: { some: {} } }, // only users with at least one account
      select: { id: true, name: true, email: true }
    });

    const now   = new Date();
    const y     = now.getFullYear();
    const m     = String(now.getMonth() + 1).padStart(2, '0');
    const monthStart = new Date(`${y}-${m}-01`);

    const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    for (const user of users) {
      try {
        // Fetch accounts + compute total balance
        const accounts = await prisma.account.findMany({
          where: { userId: user.id },
          select: { id: true, name: true }
        });
        const accountIds = accounts.map(a => a.id);

        // All transactions this month
        const txMonth = await prisma.transaction.findMany({
          where: { accountId: { in: accountIds }, date: { gte: monthStart } },
          select: { amount: true, categoryId: true, category: { select: { name: true, color: true } } }
        });

        // All transactions ever for total balance
        const allTx = await prisma.transaction.findMany({
          where: { accountId: { in: accountIds } },
          select: { amount: true }
        });

        const totalBalance    = allTx.reduce((s, t) => s + t.amount, 0);
        const monthlyIncome   = txMonth.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const monthlyExpenses = txMonth.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

        // Top 5 spending categories this month
        const catMap = {};
        for (const t of txMonth.filter(tx => tx.amount < 0)) {
          const key = t.category?.name || 'Autres';
          catMap[key] = (catMap[key] || 0) + Math.abs(t.amount);
        }
        const topCategories = Object.entries(catMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, amount]) => ({ name, amount: fmt(-amount) }));

        await sendDailyDigestEmail(user.email, {
          name: user.name,
          date,
          totalBalance: fmt(totalBalance),
          monthlyIncome: fmt(monthlyIncome),
          monthlyExpenses: fmt(monthlyExpenses),
          topCategories
        });
      } catch (err) {
        console.error(`[Cron] ❌ Failed digest for ${user.email}:`, err.message);
      }
    }

    console.log(`[Cron] ✅ Daily digest sent to ${users.length} user(s).`);
  });

  console.log('[Cron] ✅ Daily digest scheduled at 08:00.');
}

module.exports = { startDailyDigest };
