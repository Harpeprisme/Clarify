const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('clarify2024', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@clarify.app' },
    update: { passwordHash: hash, role: 'ADMIN' },
    create: { name: 'Admin', email: 'admin@clarify.app', passwordHash: hash, role: 'ADMIN' }
  });
  console.log('✅ Admin account ready:', user.email);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
