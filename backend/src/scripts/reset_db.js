const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function cleanAndRecreate() {
  try {
    // 1. Clean all tables
    console.log('[Reset] Suppression de toutes les données...');
    await prisma.transaction.deleteMany();
    await prisma.importHistory.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.categoryRule.deleteMany();
    await prisma.category.deleteMany();
    await prisma.account.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
    console.log('[Reset] ✅ Base de données nettoyée.');

    // 2. Recreate admin
    const passwordHash = await bcrypt.hash('Admin2024!', 12);
    const admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@clarify.app',
        role: 'ADMIN',
        passwordHash
      }
    });

    console.log('[Reset] ✅ Compte admin recréé (admin@clarify.app).');
  } catch (err) {
    console.error('[Reset] ❌ Erreur:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndRecreate();
