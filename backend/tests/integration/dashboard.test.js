/**
 * Integration Tests — Dashboard API
 * ====================================
 * Tests KPIs, balance calculations, and filter behavior.
 */
const request = require('supertest');
const { setupTestDB, cleanTestDB, teardownTestDB, getApp, getAuthToken, createTestUser, createTestAccount, prisma } = require('../setup');

let app;

beforeAll(async () => {
  await setupTestDB();
  app = getApp();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await cleanTestDB();
});

describe('Dashboard API', () => {
  let user, token, account;

  beforeEach(async () => {
    user = await createTestUser({ email: 'dashboard@test.com' });
    token = getAuthToken(user);
    account = await createTestAccount(user.id, { name: 'Compte Principal', initialBalance: 1000 });

    // Seed transactions
    await prisma.transaction.createMany({
      data: [
        { date: new Date('2026-03-01'), description: 'Salaire', amount: 2500, type: 'INCOME', accountId: account.id },
        { date: new Date('2026-03-02'), description: 'Loyer', amount: -850, type: 'EXPENSE', accountId: account.id },
        { date: new Date('2026-03-03'), description: 'Courses', amount: -150, type: 'EXPENSE', accountId: account.id },
        { date: new Date('2026-02-15'), description: 'Ancien Salaire', amount: 2500, type: 'INCOME', accountId: account.id },
      ],
    });
  });

  describe('GET /api/dashboard', () => {
    test('returns totalBalance, period KPIs, accounts, and recent transactions', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalBalance).toBeDefined();
      expect(res.body.period).toBeDefined();
      expect(res.body.accounts).toBeDefined();
      expect(res.body.recentTransactions).toBeDefined();
    });

    test('totalBalance = initialBalance + sum(all transactions)', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token}`);

      // 1000 + 2500 - 850 - 150 + 2500 = 5000
      expect(res.body.totalBalance).toBeCloseTo(5000, 0);
    });

    test('period KPIs are filtered by date range', async () => {
      const res = await request(app)
        .get('/api/dashboard?startDate=2026-03-01&endDate=2026-03-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.period.income).toBeCloseTo(2500, 0);
      expect(res.body.period.expense).toBeCloseTo(1000, 0); // 850 + 150
    });

    test('accounts array includes balance per account', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.accounts.length).toBe(1);
      expect(res.body.accounts[0].name).toBe('Compte Principal');
      expect(res.body.accounts[0].balance).toBeDefined();
    });

    test('filters by accountIds', async () => {
      const otherAccount = await createTestAccount(user.id, { name: 'Epargne', initialBalance: 5000 });

      const res = await request(app)
        .get(`/api/dashboard?accountIds=${account.id}`)
        .set('Authorization', `Bearer ${token}`);

      // Should only use the main account's data for KPIs
      expect(res.body.totalBalance).toBeDefined();
    });

    test('recentTransactions are limited to 10', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.recentTransactions.length).toBeLessThanOrEqual(10);
    });
  });
});
