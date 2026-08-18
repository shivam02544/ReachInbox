import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('[Seed] Seeding development database...');

  // 1. Ensure development User exists
  let user = await prisma.user.findFirst({
    where: { googleId: 'dev-google-user-123' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'dev-google-user-123',
        email: 'dev@example.com',
        name: 'Development Test User',
        avatarUrl: 'https://via.placeholder.com/150',
      },
    });
    console.log(`[Seed] Created development User: ${user.id} (${user.email})`);
  } else {
    console.log(`[Seed] Found existing development User: ${user.id} (${user.email})`);
  }

  // 2. Ensure development Sender exists
  let sender = await prisma.sender.findFirst({
    where: { userId: user.id, email: 'sender@example.com' },
  });

  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        userId: user.id,
        email: 'sender@example.com',
        displayName: 'Dev Sender',
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUser: 'dev_ethereal_user',
        smtpPassword: 'dev_ethereal_password',
      },
    });
    console.log(`[Seed] Created development Sender: ${sender.id} (${sender.email})`);
  } else {
    console.log(`[Seed] Found existing development Sender: ${sender.id} (${sender.email})`);
  }

  console.log('[Seed] Seed completed successfully.');
  console.log('==================================================');
  console.log(`Development User ID:   ${user.id}`);
  console.log(`Development Sender ID: ${sender.id}`);
  console.log('==================================================');
}

seed()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
