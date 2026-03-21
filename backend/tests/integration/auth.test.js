/**
 * Integration Tests — Auth API
 * =============================
 * Tests login, JWT authentication, and profile endpoints.
 * NOTE: Register creates a user with mustChangePassword=true and sends email.
 *       For tests, we use createTestUser() to create users with known passwords.
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

describe('Auth API', () => {

  // ────────────────────────────────────────────────────
  // POST /api/auth/login
  // ────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    test('returns JWT for valid credentials', async () => {
      await createTestUser({ email: 'bob@test.com', password: 'BobPass123!' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bob@test.com', password: 'BobPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('bob@test.com');
    });

    test('rejects wrong password', async () => {
      await createTestUser({ email: 'bob@test.com', password: 'BobPass123!' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bob@test.com', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
    });

    test('rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'Pass123!' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bob@test.com' }); // No password

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────
  // GET /api/auth/me
  // ────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    test('returns user profile with valid JWT', async () => {
      const user = await createTestUser({ email: 'me@test.com' });
      const token = getAuthToken(user);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@test.com');
      expect(res.body.id).toBe(user.id);
    });

    test('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-here');
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/auth/change-password
  // ────────────────────────────────────────────────────
  describe('POST /api/auth/change-password', () => {
    test('changes password successfully', async () => {
      const user = await createTestUser({ email: 'charlie@test.com', password: 'OldPass123!' });
      const token = getAuthToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass456!' });

      expect(res.status).toBe(200);

      // Verify login with new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'charlie@test.com', password: 'NewPass456!' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    test('rejects weak new password', async () => {
      const user = await createTestUser({ email: 'weak@test.com', password: 'OldPass123!' });
      const token = getAuthToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPass123!', newPassword: 'weak' });

      expect(res.status).toBe(400);
    });

    test('rejects wrong current password', async () => {
      const user = await createTestUser({ email: 'wrong@test.com', password: 'OldPass123!' });
      const token = getAuthToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongOld!', newPassword: 'NewPass456!' });

      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────
  // PATCH /api/auth/profile
  // ────────────────────────────────────────────────────
  describe('PATCH /api/auth/profile', () => {
    test('updates name', async () => {
      const user = await createTestUser({ email: 'profile@test.com', name: 'Old Name' });
      const token = getAuthToken(user);

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });
  });

  // ────────────────────────────────────────────────────
  // Health check
  // ────────────────────────────────────────────────────
  describe('GET /api/health', () => {
    test('returns ok status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
