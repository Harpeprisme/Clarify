const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Create Default Categories
  const categoriesData = [
    { name: 'Logement', color: '#8B5CF6', icon: 'home' }, // Violet
    { name: 'Alimentation', color: '#10B981', icon: 'shopping-cart' }, // Emerald
    { name: 'Transport', color: '#F59E0B', icon: 'truck' }, // Amber
    { name: 'Abonnements', color: '#3B82F6', icon: 'tv' }, // Blue
    { name: 'Loisirs', color: '#EC4899', icon: 'film' }, // Pink
    { name: 'Santé', color: '#EF4444', icon: 'heart' }, // Red
    { name: 'Impôts', color: '#6B7280', icon: 'file-text' }, // Gray
    { name: 'Épargne', color: '#14B8A6', icon: 'briefcase' }, // Teal
    { name: 'Revenus', color: '#22C55E', icon: 'dollar-sign' }, // Green
    { name: 'Virement', color: '#6366F1', icon: 'refresh-cw' }, // Indigo
    { name: 'Autres', color: '#9CA3AF', icon: 'help-circle' }, // Light Gray
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isDefault: true
      }
    });
  }

  // 2. Create Default Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@openbank.local' },
    update: {},
    create: {
      name: 'Julien (Admin)',
      email: 'admin@openbank.local',
      passwordHash: '$2a$10$dummyHashToImplementLater',
      role: 'ADMIN'
    }
  });

  // 3. Create Default Accounts
  const account1 = await prisma.account.create({
    data: {
      name: 'Compte Courant Principal',
      type: 'COURANT',
      userId: adminUser.id
    }
  });

  const account2 = await prisma.account.create({
    data: {
      name: 'Livret A',
      type: 'LIVRET_A',
      userId: adminUser.id
    }
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
