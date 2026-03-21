/**
 * Integration Tests — Budgets API
 * ==================================
 * Tests CRUD operations for budgets.
 * NOTE: Budget API uses 'GLOBAL' as month value (not actual month strings).
 */
const request = require('supertest');
const { setupTestDB, cleanTestDB, teardownTestDB, getApp, getAuthToken, createTestUser, prisma } = require('../setup');

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

describe('Budgets API', () => {
  let user, token, category;

  beforeEach(async () => {
    user = await createTestUser({ email: 'budgets@test.com' });
    token = getAuthToken(user);
    category = await prisma.category.findFirst({ where: { name: 'Alimentation' } });
  });

  describe('POST /api/budgets', () => {
    test('creates or updates a global budget', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 500, categoryId: category.id });

      expect(res.status).toBe(200);
      expect(res.body.amount).toBe(500);
      expect(res.body.categoryId).toBe(category.id);
      expect(res.body.month).toBe('GLOBAL');
    });

    test('upserts: second call updates existing budget', async () => {
      // Create
      await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 500, categoryId: category.id });

      // Update
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 700, categoryId: category.id });

      expect(res.status).toBe(200);
      expect(res.body.amount).toBe(700);

      // Should still be only 1 budget
      const count = await prisma.budget.count({ where: { userId: user.id } });
      expect(count).toBe(1);
    });

    test('rejects without categoryId', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 500 }); // no categoryId

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/budgets', () => {
    test('lists GLOBAL budgets for the user', async () => {
      await prisma.budget.create({
        data: { amount: 500, month: 'GLOBAL', categoryId: category.id, userId: user.id },
      });

      const res = await request(app)
        .get('/api/budgets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].amount).toBe(500);
      expect(res.body[0].category).toBeDefined();
    });

    test('returns empty for user with no budgets', async () => {
      const res = await request(app)
        .get('/api/budgets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
