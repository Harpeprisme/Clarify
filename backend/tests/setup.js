/**
 * Test Setup & Helpers
 * ====================
 * Provides isolated test database, auth helpers, and factory functions.
 */
const { execSync } = require('child_process');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Force test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-automated-tests';
process.env.DATABASE_URL = 'file:./prisma/test.db';

// We need to re-require prisma after setting env
// Clear module cache for prisma client
delete require.cache[require.resolve('../src/config/prisma')];

const prisma = require('../src/config/prisma');

/**
 * Initialize the test database: push schema without migrations
 */
async function setupTestDB() {
  execSync('npx prisma db push --force-reset --accept-data-loss', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' },
    stdio: 'pipe',
  });

  // Seed default categories (from seed.js logic)
  const defaultCategories = [
    { name: 'Alimentation', color: '#FF6384', icon: 'shopping-cart', isDefault: true },
    { name: 'Transport', color: '#36A2EB', icon: 'car', isDefault: true },
    { name: 'Logement', color: '#FFCE56', icon: 'home', isDefault: true },
    { name: 'Abonnements', color: '#4BC0C0', icon: 'refresh-cw', isDefault: true },
    { name: 'Loisirs', color: '#9966FF', icon: 'film', isDefault: true },
    { name: 'Santé', color: '#FF9F40', icon: 'heart', isDefault: true },
    { name: 'Impôts', color: '#C9CBCF', icon: 'file-text', isDefault: true },
    { name: 'Épargne', color: '#27AE60', icon: 'piggy-bank', isDefault: true },
    { name: 'Investissement', color: '#2ECC71', icon: 'trending-up', isDefault: true },
    { name: 'Revenus', color: '#27AE60', icon: 'dollar-sign', isDefault: true },
    { name: 'Virement', color: '#3498DB', icon: 'repeat', isDefault: true },
    { name: 'Autres', color: '#6B7280', icon: 'tag', isDefault: true },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // Seed default account types
  const accountTypes = [
    { id: 'COURANT', name: 'Compte Courant', group: 'COURANT' },
    { id: 'LIVRET_A', name: 'Livret A', group: 'EPARGNE' },
    { id: 'PEA', name: 'PEA', group: 'INVESTISSEMENT' },
    { id: 'PEL', name: 'PEL', group: 'EPARGNE' },
    { id: 'CTO', name: 'Compte-Titres', group: 'INVESTISSEMENT' },
    { id: 'CREDIT', name: 'Crédit', group: 'CREDIT' },
    { id: 'LOA', name: 'LOA', group: 'CREDIT' },
  ];

  for (const at of accountTypes) {
    await prisma.accountType.upsert({
      where: { id: at.id },
      update: {},
      create: at,
    });
  }
}

/**
 * Clean all data from test database (preserving categories & account types)
 */
async function cleanTestDB() {
  // Delete in order to respect foreign key constraints
  await prisma.recurringTransaction.deleteMany();
  await prisma.forecastSettings.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.importHistory.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Completely tear down the test database
 */
async function teardownTestDB() {
  await prisma.$disconnect();
  const fs = require('fs');
  const dbPath = path.join(__dirname, '..', 'prisma', 'test.db');
  const journalPath = dbPath + '-journal';
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  for (const f of [dbPath, journalPath, walPath, shmPath]) {
    try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
  }
}

/**
 * Create a test user and return the user object
 */
async function createTestUser(overrides = {}) {
  const hash = await bcrypt.hash(overrides.password || 'TestPass123!', 4); // Low rounds for speed
  const user = await prisma.user.create({
    data: {
      name: overrides.name || 'Test User',
      email: overrides.email || `test-${Date.now()}@clarify.app`,
      passwordHash: hash,
      role: overrides.role || 'ADMIN',
      ...overrides,
      password: undefined, // Don't persist raw password
    },
  });
  return user;
}

/**
 * Generate a valid JWT token for a user
 */
function getAuthToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Create a test account for a user
 */
async function createTestAccount(userId, overrides = {}) {
  return prisma.account.create({
    data: {
      name: overrides.name || 'Compte Test',
      type: overrides.type || 'COURANT',
      initialBalance: overrides.initialBalance || 0,
      userId,
    },
  });
}

/**
 * Get the Express app (with test DB)
 */
function getApp() {
  // Clear cached modules to ensure fresh app with test DB
  delete require.cache[require.resolve('../src/index')];
  return require('../src/index');
}

module.exports = {
  prisma,
  setupTestDB,
  cleanTestDB,
  teardownTestDB,
  createTestUser,
  getAuthToken,
  createTestAccount,
  getApp,
};
