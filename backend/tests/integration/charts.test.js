/**
 * Integration Tests — Charts API
 * ================================
 * Tests chart data endpoints: expenses by category, income vs expenses, balance evolution.
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

describe('Charts API', () => {
  let user, token, account;

  beforeEach(async () => {
    user = await createTestUser({ email: 'charts@test.com' });
    token = getAuthToken(user);
    account = await createTestAccount(user.id, { name: 'Compte Charts', initialBalance: 1000 });

    const catAlim = await prisma.category.findFirst({ where: { name: 'Alimentation' } });
    const catLogement = await prisma.category.findFirst({ where: { name: 'Logement' } });

    await prisma.transaction.createMany({
      data: [
        { date: new Date('2026-02-01'), description: 'Salaire fev', amount: 2500, type: 'INCOME', accountId: account.id },
        { date: new Date('2026-02-05'), description: 'Loyer fev', amount: -850, type: 'EXPENSE', accountId: account.id, categoryId: catLogement?.id },
        { date: new Date('2026-02-10'), description: 'Courses fev', amount: -150, type: 'EXPENSE', accountId: account.id, categoryId: catAlim?.id },
        { date: new Date('2026-03-01'), description: 'Salaire mars', amount: 2500, type: 'INCOME', accountId: account.id },
        { date: new Date('2026-03-05'), description: 'Loyer mars', amount: -850, type: 'EXPENSE', accountId: account.id, categoryId: catLogement?.id },
        { date: new Date('2026-03-10'), description: 'Courses mars', amount: -200, type: 'EXPENSE', accountId: account.id, categoryId: catAlim?.id },
      ],
    });
  });

  describe('GET /api/charts/expenses-by-category', () => {
    test('returns expenses grouped by category', async () => {
      const res = await request(app)
        .get('/api/charts/expenses-by-category')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Each item should have name, value, color
      for (const item of res.body) {
        expect(item.name).toBeDefined();
        expect(item.value).toBeDefined();
        expect(typeof item.value).toBe('number');
        expect(item.value).toBeGreaterThan(0);
      }
    });

    test('filters by date range', async () => {
      const res = await request(app)
        .get('/api/charts/expenses-by-category?startDate=2026-03-01&endDate=2026-03-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Should only include March expenses
      const total = res.body.reduce((sum, item) => sum + item.value, 0);
      expect(total).toBeCloseTo(1050, 0); // 850 + 200
    });
  });

  describe('GET /api/charts/income-vs-expenses', () => {
    test('returns monthly income and expense data', async () => {
      const res = await request(app)
        .get('/api/charts/income-vs-expenses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // Feb + March

      for (const month of res.body) {
        expect(month.month).toMatch(/^\d{4}-\d{2}$/);
        expect(month.income).toBeDefined();
        expect(month.expense).toBeDefined();
        expect(month.savings).toBeDefined();
      }
    });

    test('savings = income - expense', async () => {
      const res = await request(app)
        .get('/api/charts/income-vs-expenses')
        .set('Authorization', `Bearer ${token}`);

      for (const month of res.body) {
        expect(month.savings).toBeCloseTo(month.income - month.expense, 2);
      }
    });
  });

  describe('GET /api/charts/balance-evolution', () => {
    test('returns daily balance points', async () => {
      const res = await request(app)
        .get('/api/charts/balance-evolution')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      for (const point of res.body) {
        expect(point.date).toBeDefined();
        expect(typeof point.balance).toBe('number');
      }
    });

    test('balance evolution is monotonically calculated from initial', async () => {
      const res = await request(app)
        .get('/api/charts/balance-evolution')
        .set('Authorization', `Bearer ${token}`);

      // The last point's balance should equal initialBalance + sum(all tx)
      const lastPoint = res.body[res.body.length - 1];
      const expectedFinal = 1000 + 2500 - 850 - 150 + 2500 - 850 - 200;
      expect(lastPoint.balance).toBeCloseTo(expectedFinal, 0);
    });
  });
});
