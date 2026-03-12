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

    // 3. Recreate Default Categories (required for smart categorizer)
    console.log('[Reset] Recréation des catégories par défaut...');
    const categoriesData = [
      { name: 'Logement', color: '#8B5CF6', icon: 'home' },
      { name: 'Alimentation', color: '#10B981', icon: 'shopping-cart' },
      { name: 'Transport', color: '#F59E0B', icon: 'truck' },
      { name: 'Abonnements', color: '#3B82F6', icon: 'tv' },
      { name: 'Loisirs', color: '#EC4899', icon: 'film' },
      { name: 'Santé', color: '#EF4444', icon: 'heart' },
      { name: 'Impôts', color: '#6B7280', icon: 'file-text' },
      { name: 'Épargne', color: '#14B8A6', icon: 'briefcase' },
      { name: 'Revenus', color: '#22C55E', icon: 'dollar-sign' },
      { name: 'Virement', color: '#6366F1', icon: 'refresh-cw' },
      { name: 'Autres', color: '#9CA3AF', icon: 'help-circle' },
    ];

    let count = 0;
    for (const cat of categoriesData) {
      await prisma.category.create({
        data: {
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          isDefault: true
        }
      });
      count++;
    }
    console.log(`[Reset] ✅ ${count} catégories par défaut recréées.`);

  } catch (err) {
    console.error('[Reset] ❌ Erreur:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndRecreate();
