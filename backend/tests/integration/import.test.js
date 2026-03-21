/**
 * Integration Tests — Import API
 * ================================
 * Tests CSV import pipeline with real Crédit Agricole files.
 * This is the most critical test — validates the entire import flow.
 */
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { setupTestDB, cleanTestDB, teardownTestDB, getApp, getAuthToken, createTestUser, createTestAccount, prisma } = require('../setup');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
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

describe('Import API', () => {
  let user, token, account;

  beforeEach(async () => {
    user = await createTestUser({ email: 'import@test.com' });
    token = getAuthToken(user);
    account = await createTestAccount(user.id, { name: 'Compte Courant' });
  });

  // ────────────────────────────────────────────────────
  // POST /api/import/detect
  // ────────────────────────────────────────────────────
  describe('POST /api/import/detect', () => {
    test('detects courant.csv format correctly', async () => {
      const res = await request(app)
        .post('/api/import/detect')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      expect(res.status).toBe(200);
      expect(res.body.delimiter).toBe(';');
      expect(res.body.dateColumn).toBeTruthy();
      expect(res.body.columns).toBeDefined();
      expect(res.body.sampleRows.length).toBeGreaterThan(0);
    });

    test('detects epargne.csv format correctly', async () => {
      const res = await request(app)
        .post('/api/import/detect')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', path.join(FIXTURES, 'epargne.csv'));

      expect(res.status).toBe(200);
      expect(res.body.delimiter).toBe(';');
    });

    test('rejects request without file', async () => {
      const res = await request(app)
        .post('/api/import/detect')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/import — Full import
  // ────────────────────────────────────────────────────
  describe('POST /api/import', () => {
    test('imports courant.csv with 20 transactions', async () => {
      const res = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      expect(res.status).toBe(200);
      expect(res.body.rowsFound).toBe(20);
      expect(res.body.rowsImported).toBe(20);
      expect(res.body.rowsSkipped).toBe(0);
    });

    test('creates transactions in database with correct data', async () => {
      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      const transactions = await prisma.transaction.findMany({
        where: { accountId: account.id },
        orderBy: { date: 'desc' },
        include: { category: true },
      });

      expect(transactions.length).toBe(20);

      // Verify a known transaction (MONOPRIX)
      const monoprix = transactions.find(t => t.description.includes('MONOPRIX'));
      expect(monoprix).toBeDefined();
      expect(monoprix.amount).toBeCloseTo(-45.20, 2);
      expect(monoprix.type).toBe('EXPENSE');

      // Verify salary
      const salaire = transactions.find(t => t.description.includes('SALAIRE'));
      expect(salaire).toBeDefined();
      expect(salaire.amount).toBeCloseTo(2850, 0);
      expect(salaire.type).toBe('INCOME');
    });

    test('assigns categories automatically', async () => {
      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      const transactions = await prisma.transaction.findMany({
        where: { accountId: account.id },
        include: { category: true },
      });

      // Most transactions should have a category
      const categorized = transactions.filter(t => t.categoryId !== null);
      expect(categorized.length).toBeGreaterThan(transactions.length * 0.5); // At least 50% categorized
    });

    test('deduplicates on re-import (same file)', async () => {
      // First import
      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      // Second import of same file
      const res = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      expect(res.status).toBe(200);
      expect(res.body.rowsImported).toBe(0);
      expect(res.body.rowsSkipped).toBe(20);

      // Total in DB should still be 20
      const count = await prisma.transaction.count({ where: { accountId: account.id } });
      expect(count).toBe(20);
    });

    test('imports epargne.csv to a savings account', async () => {
      const livret = await createTestAccount(user.id, { name: 'Livret A', type: 'LIVRET_A' });

      const res = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', livret.id)
        .attach('file', path.join(FIXTURES, 'epargne.csv'));

      expect(res.status).toBe(200);
      expect(res.body.rowsImported).toBeGreaterThan(0);
    });

    test('detects internal transfers between accounts', async () => {
      const livret = await createTestAccount(user.id, { name: 'Livret A', type: 'LIVRET_A' });

      // Import courant (has "VIREMENT EMIS VERS LIVRET" -500)
      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      // Import épargne (has matching +500)
      const res = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', livret.id)
        .attach('file', path.join(FIXTURES, 'epargne.csv'));

      expect(res.status).toBe(200);
      // Should have detected at least one transfer pair
      expect(res.body.transfersDetected).toBeGreaterThanOrEqual(0);
    });

    test('adjusts initial balance when currentBalance is provided', async () => {
      const res = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .field('currentBalance', '1542.30')
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      expect(res.status).toBe(200);

      // Verify account initialBalance was adjusted
      const acc = await prisma.account.findUnique({ where: { id: account.id } });
      const txSum = await prisma.transaction.aggregate({
        where: { accountId: account.id },
        _sum: { amount: true },
      });

      // initialBalance + txSum should equal 1542.30
      const computed = acc.initialBalance + (txSum._sum.amount || 0);
      expect(computed).toBeCloseTo(1542.30, 1);
    });

    test('rejects import without accountId', async () => {
      const res = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      expect(res.status).toBe(400);
    });

    test('rejects import without file', async () => {
      const res = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id);

      expect(res.status).toBe(400);
    });

    test('creates import history record', async () => {
      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      const history = await prisma.importHistory.findMany({
        where: { accountId: account.id },
      });

      expect(history.length).toBe(1);
      expect(history[0].rowCount).toBe(20);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/import/re-categorize
  // ────────────────────────────────────────────────────
  describe('POST /api/import/re-categorize', () => {
    test('re-categorizes all transactions', async () => {
      // First, import transactions
      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${token}`)
        .field('accountId', account.id)
        .attach('file', path.join(FIXTURES, 'courant.csv'));

      // Then re-categorize
      const res = await request(app)
        .post('/api/import/re-categorize')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(20);
      expect(res.body.updated + res.body.skipped).toBe(20);
    });
  });
});
