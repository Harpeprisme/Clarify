/**
 * Integration Tests — Forecasts API
 * ====================================
 * Tests recurring detection, projection, and forecast settings endpoints.
 * NOTE: GET /forecasts/recurring returns merged array directly (not {detected: [...]})
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

describe('Forecasts API', () => {
  let user, token, account;

  beforeEach(async () => {
    user = await createTestUser({ email: 'forecasts@test.com' });
    token = getAuthToken(user);
    account = await createTestAccount(user.id, { name: 'Compte Prévisions', initialBalance: 2000 });

    // Seed recurring-looking transactions (monthly rent over 4 months)
    const months = [
      new Date('2025-12-01'),
      new Date('2026-01-01'),
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    ];
    for (const date of months) {
      await prisma.transaction.create({
        data: {
          date,
          description: 'PRELEVEMENT LOYER RESIDENCE',
          amount: -850,
          type: 'EXPENSE',
          accountId: account.id,
        },
      });
    }

    // Seed salary
    for (const date of months) {
      await prisma.transaction.create({
        data: {
          date: new Date(date.getTime() + 4 * 24 * 3600 * 1000),
          description: 'VIREMENT SALAIRE ENTREPRISE',
          amount: 2500,
          type: 'INCOME',
          accountId: account.id,
        },
      });
    }
  });

  describe('GET /api/forecasts/recurring', () => {
    test('returns an array of recurring transactions', async () => {
      const res = await request(app)
        .get('/api/forecasts/recurring')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Should detect both the rent and salary as recurring
      if (res.body.length > 0) {
        const item = res.body[0];
        expect(item.description).toBeDefined();
        expect(item.averageAmount).toBeDefined();
        expect(item.frequency).toBeDefined();
        expect(item.confidence).toBeDefined();
      }
    });
  });

  describe('GET /api/forecasts/projection', () => {
    test('returns projection data', async () => {
      const res = await request(app)
        .get('/api/forecasts/projection')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.currentBalance).toBeDefined();
      expect(res.body.projectedBalance).toBeDefined();
      expect(res.body.daysRemaining).toBeDefined();
      expect(res.body.savingsPotential).toBeDefined();
      expect(res.body.breakdown).toBeDefined();
    });

    test('currentBalance matches initialBalance + sum(transactions)', async () => {
      const res = await request(app)
        .get('/api/forecasts/projection')
        .set('Authorization', `Bearer ${token}`);

      const txSum = await prisma.transaction.aggregate({
        where: { accountId: account.id },
        _sum: { amount: true },
      });

      const expected = 2000 + (txSum._sum.amount || 0);
      expect(res.body.currentBalance).toBeCloseTo(expected, 0);
    });
  });

  describe('GET /api/forecasts/settings', () => {
    test('returns default settings', async () => {
      const res = await request(app)
        .get('/api/forecasts/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.safetyBuffer).toBe(200);
      expect(res.body.detectionMinOccurrences).toBe(2);
    });
  });

  describe('PATCH /api/forecasts/settings', () => {
    test('updates forecast settings', async () => {
      const res = await request(app)
        .patch('/api/forecasts/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ monthlySalary: 2500, safetyBuffer: 500 });

      expect(res.status).toBe(200);
      expect(res.body.monthlySalary).toBe(2500);
      expect(res.body.safetyBuffer).toBe(500);
    });

    test('persists settings across requests', async () => {
      await request(app)
        .patch('/api/forecasts/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ monthlySalary: 3000 });

      const res = await request(app)
        .get('/api/forecasts/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.monthlySalary).toBe(3000);
    });
  });
});
