/**
 * Integration Tests — Categories API
 * =====================================
 * Tests CRUD operations for categories.
 * NOTE: Update uses PUT (not PATCH), delete won't work on default categories.
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

describe('Categories API', () => {
  let user, token;

  beforeEach(async () => {
    user = await createTestUser({ email: 'categories@test.com' });
    token = getAuthToken(user);
  });

  describe('GET /api/categories', () => {
    test('returns default categories', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(10);

      const names = res.body.map(c => c.name);
      expect(names).toContain('Alimentation');
      expect(names).toContain('Transport');
      expect(names).toContain('Logement');
      expect(names).toContain('Revenus');
      expect(names).toContain('Autres');
    });

    test('categories have required fields', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${token}`);

      for (const cat of res.body) {
        expect(cat.id).toBeDefined();
        expect(cat.name).toBeDefined();
        expect(cat.color).toBeDefined();
      }
    });
  });

  describe('POST /api/categories', () => {
    test('creates a custom category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Animaux', color: '#FF00FF', icon: 'paw' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Animaux');
      expect(res.body.color).toBe('#FF00FF');
    });

    test('rejects without name', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ color: '#FF00FF' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/categories/:id', () => {
    test('updates a custom category', async () => {
      const cat = await prisma.category.create({
        data: { name: 'Test Cat', color: '#000000', userId: user.id },
      });

      const res = await request(app)
        .put(`/api/categories/${cat.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Cat Updated', color: '#FF0000' });

      expect(res.status).toBe(200);
      expect(res.body.color).toBe('#FF0000');
    });

    test('rejects modifying default categories', async () => {
      const defaultCat = await prisma.category.findFirst({ where: { name: 'Alimentation', isDefault: true } });

      const res = await request(app)
        .put(`/api/categories/${defaultCat.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed', color: '#FF0000' });

      // Should reject since it's a default and doesn't belong to the user
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    test('deletes a custom category', async () => {
      const cat = await prisma.category.create({
        data: { name: 'A Supprimer', color: '#000000', userId: user.id },
      });

      const res = await request(app)
        .delete(`/api/categories/${cat.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });

    test('rejects deleting default categories', async () => {
      const defaultCat = await prisma.category.findFirst({ where: { name: 'Alimentation', isDefault: true } });

      const res = await request(app)
        .delete(`/api/categories/${defaultCat.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
