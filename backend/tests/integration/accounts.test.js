/**
 * Integration Tests — Accounts API
 * ==================================
 * Tests CRUD operations, balance calculations, and access isolation.
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

describe('Accounts API', () => {
  let user, token;

  beforeEach(async () => {
    user = await createTestUser({ email: 'accounts@test.com' });
    token = getAuthToken(user);
  });

  // ────────────────────────────────────────────────────
  // POST /api/accounts
  // ────────────────────────────────────────────────────
  describe('POST /api/accounts', () => {
    test('creates a new account', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Compte Courant Principal', type: 'COURANT' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Compte Courant Principal');
      expect(res.body.type).toBe('COURANT');
      expect(res.body.balance).toBe(0);
    });

    test('creates account with initial balance', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Mon Livret', type: 'LIVRET_A', currentBalance: 5000 });

      expect(res.status).toBe(201);
      expect(res.body.balance).toBe(5000);
    });

    test('rejects without name', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'COURANT' });

      expect(res.status).toBe(400);
    });

    test('rejects without auth', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .send({ name: 'Test', type: 'COURANT' });

      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────
  // GET /api/accounts
  // ────────────────────────────────────────────────────
  describe('GET /api/accounts', () => {
    test('lists user accounts with balance', async () => {
      await createTestAccount(user.id, { name: 'Compte 1' });
      await createTestAccount(user.id, { name: 'Compte 2' });

      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].balance).toBeDefined();
    });

    test('returns correct balance (initialBalance + transactions)', async () => {
      const account = await createTestAccount(user.id, { name: 'Compte Calcul', initialBalance: 1000 });

      // Add some transactions
      await prisma.transaction.createMany({
        data: [
          { date: new Date(), description: 'Salaire', amount: 2000, type: 'INCOME', accountId: account.id },
          { date: new Date(), description: 'Loyer', amount: -800, type: 'EXPENSE', accountId: account.id },
        ],
      });

      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const acc = res.body.find(a => a.name === 'Compte Calcul');
      expect(acc.balance).toBeCloseTo(2200, 2); // 1000 + 2000 - 800
    });

    test('does not show other user accounts', async () => {
      const otherUser = await createTestUser({ email: 'other@test.com' });
      await createTestAccount(otherUser.id, { name: 'Compte Autre User' });
      await createTestAccount(user.id, { name: 'Mon Compte' });

      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Mon Compte');
    });
  });

  // ────────────────────────────────────────────────────
  // PATCH /api/accounts/:id
  // ────────────────────────────────────────────────────
  describe('PATCH /api/accounts/:id', () => {
    test('updates account name', async () => {
      const account = await createTestAccount(user.id, { name: 'Ancient Nom' });

      const res = await request(app)
        .patch(`/api/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nouveau Nom' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Nouveau Nom');
    });

    test('adjusts initialBalance when currentBalance is set', async () => {
      const account = await createTestAccount(user.id, { name: 'Balance Test', initialBalance: 0 });

      // Add a transaction
      await prisma.transaction.create({
        data: { date: new Date(), description: 'Test', amount: 500, type: 'INCOME', accountId: account.id },
      });

      // Set current balance to 1000 → initialBalance should become 500 (1000 - 500)
      const res = await request(app)
        .patch(`/api/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentBalance: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.initialBalance).toBeCloseTo(500, 2);
    });

    test('rejects update of other user account', async () => {
      const otherUser = await createTestUser({ email: 'other2@test.com' });
      const otherAccount = await createTestAccount(otherUser.id, { name: 'Pas le mien' });

      const res = await request(app)
        .patch(`/api/accounts/${otherAccount.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Stolen' });

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────
  // DELETE /api/accounts/:id
  // ────────────────────────────────────────────────────
  describe('DELETE /api/accounts/:id', () => {
    test('deletes account and cascades transactions', async () => {
      const account = await createTestAccount(user.id, { name: 'A Supprimer' });
      await prisma.transaction.create({
        data: { date: new Date(), description: 'Test', amount: 100, type: 'INCOME', accountId: account.id },
      });

      const res = await request(app)
        .delete(`/api/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify account and transactions are gone
      const acc = await prisma.account.findUnique({ where: { id: account.id } });
      expect(acc).toBeNull();
      const txs = await prisma.transaction.findMany({ where: { accountId: account.id } });
      expect(txs).toHaveLength(0);
    });
  });
});
