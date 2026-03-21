/**
 * Integration Tests — Transactions API
 * =======================================
 * Tests CRUD, filters, pagination, and access control.
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

describe('Transactions API', () => {
  let user, token, account;

  beforeEach(async () => {
    user = await createTestUser({ email: 'tx@test.com' });
    token = getAuthToken(user);
    account = await createTestAccount(user.id, { name: 'Compte TX' });
  });

  // ────────────────────────────────────────────────────
  // POST /api/transactions
  // ────────────────────────────────────────────────────
  describe('POST /api/transactions', () => {
    test('creates a transaction manually', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-03-10',
          description: 'Test manuel',
          amount: -50,
          accountId: account.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.description).toBe('Test manuel');
      expect(res.body.amount).toBe(-50);
      expect(res.body.type).toBe('EXPENSE');
    });

    test('auto-assigns type based on amount sign', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-03-10',
          description: 'Virement reçu',
          amount: 100,
          accountId: account.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('INCOME');
    });

    test('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Incomplete' });

      expect(res.status).toBe(400);
    });

    test('rejects access to other user account', async () => {
      const otherUser = await createTestUser({ email: 'other-tx@test.com' });
      const otherAccount = await createTestAccount(otherUser.id, { name: 'Autre' });

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-03-10',
          description: 'Hack attempt',
          amount: -9999,
          accountId: otherAccount.id,
        });

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────
  // GET /api/transactions
  // ────────────────────────────────────────────────────
  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      // Seed some transactions
      const cat = await prisma.category.findFirst({ where: { name: 'Alimentation' } });
      await prisma.transaction.createMany({
        data: [
          { date: new Date('2026-02-01'), description: 'Loyer février', amount: -850, type: 'EXPENSE', accountId: account.id, categoryId: cat?.id },
          { date: new Date('2026-02-15'), description: 'Salaire février', amount: 2500, type: 'INCOME', accountId: account.id },
          { date: new Date('2026-03-01'), description: 'Loyer mars', amount: -850, type: 'EXPENSE', accountId: account.id, categoryId: cat?.id },
          { date: new Date('2026-03-05'), description: 'Courses Monoprix', amount: -45, type: 'EXPENSE', accountId: account.id, categoryId: cat?.id },
          { date: new Date('2026-03-10'), description: 'Salaire mars', amount: 2500, type: 'INCOME', accountId: account.id },
        ],
      });
    });

    test('lists transactions with pagination', async () => {
      const res = await request(app)
        .get('/api/transactions?page=1&limit=3')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.totalPages).toBe(2);
    });

    test('filters by type', async () => {
      const res = await request(app)
        .get('/api/transactions?type=INCOME')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      res.body.data.forEach(tx => expect(tx.type).toBe('INCOME'));
    });

    test('filters by date range', async () => {
      const res = await request(app)
        .get('/api/transactions?startDate=2026-03-01&endDate=2026-03-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3); // 3 March transactions
    });

    test('filters by search text', async () => {
      const res = await request(app)
        .get('/api/transactions?search=Loyer')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    test('returns transactions ordered by date desc', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${token}`);

      const dates = res.body.data.map(tx => new Date(tx.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });
  });

  // ────────────────────────────────────────────────────
  // PATCH /api/transactions/:id
  // ────────────────────────────────────────────────────
  describe('PATCH /api/transactions/:id', () => {
    test('updates transaction category', async () => {
      const tx = await prisma.transaction.create({
        data: { date: new Date(), description: 'Test', amount: -50, type: 'EXPENSE', accountId: account.id },
      });
      const cat = await prisma.category.findFirst({ where: { name: 'Loisirs' } });

      const res = await request(app)
        .patch(`/api/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ categoryId: cat.id });

      expect(res.status).toBe(200);
      expect(res.body.categoryId).toBe(cat.id);
    });

    test('rejects update of other user transaction', async () => {
      const otherUser = await createTestUser({ email: 'other-tx2@test.com' });
      const otherAccount = await createTestAccount(otherUser.id);
      const tx = await prisma.transaction.create({
        data: { date: new Date(), description: 'Other', amount: -50, type: 'EXPENSE', accountId: otherAccount.id },
      });

      const res = await request(app)
        .patch(`/api/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Hacked' });

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────
  // DELETE /api/transactions/:id
  // ────────────────────────────────────────────────────
  describe('DELETE /api/transactions/:id', () => {
    test('deletes a transaction', async () => {
      const tx = await prisma.transaction.create({
        data: { date: new Date(), description: 'A supprimer', amount: -10, type: 'EXPENSE', accountId: account.id },
      });

      const res = await request(app)
        .delete(`/api/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const deleted = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(deleted).toBeNull();
    });
  });
});
