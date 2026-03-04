import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function adminIds() {
  return (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function main() {
  const ids = adminIds();
  if (ids[0]) {
    await prisma.user.upsert({
      where: { telegramId: ids[0] },
      update: { role: 'admin', firstName: 'Admin' },
      create: { telegramId: ids[0], role: 'admin', firstName: 'Admin' }
    });
    console.log('Seeded admin telegramId:', ids[0]);
  } else {
    console.log('ADMIN_TELEGRAM_IDS not set; admin not seeded');
  }

  // Demo track (no file)
  const t = await prisma.track.create({
    data: { title: 'Demo Track', artist: 'Demo Artist', isPublished: true }
  });
  console.log('Seeded demo track:', t.id);
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
