import { PrismaClient } from '@prisma/client';
import { DEFAULT_TEMPLATES } from '../src/lib/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  console.log(`✅ Loaded ${DEFAULT_TEMPLATES.length} default template blueprints.`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
