import { PrismaClient } from '@prisma/client';
import { config } from '../src/config/env';

const prisma = new PrismaClient();

async function seed() {
  console.log('[Seed] Seeding development database with Ethereal Senders...');

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

  // 2. Ensure Sender A (Primary Ethereal Sender) exists
  let senderA = await prisma.sender.findFirst({
    where: { userId: user.id, email: 'senderA@example.com' },
  });

  if (!senderA) {
    senderA = await prisma.sender.create({
      data: {
        userId: user.id,
        email: 'senderA@example.com',
        displayName: 'Sender Alpha',
        smtpHost: config.ethereal.host,
        smtpPort: config.ethereal.port,
        smtpUser: config.ethereal.user,
        smtpPassword: config.ethereal.pass,
      },
    });
    console.log(`[Seed] Created Sender A: ${senderA.id} (${senderA.email})`);
  } else {
    // Ensure credentials match current env
    senderA = await prisma.sender.update({
      where: { id: senderA.id },
      data: {
        smtpHost: config.ethereal.host,
        smtpPort: config.ethereal.port,
        smtpUser: config.ethereal.user,
        smtpPassword: config.ethereal.pass,
      },
    });
    console.log(`[Seed] Updated Sender A: ${senderA.id} (${senderA.email})`);
  }

  // 3. Ensure Sender B (Secondary Sender sharing development Ethereal SMTP) exists
  let senderB = await prisma.sender.findFirst({
    where: { userId: user.id, email: 'senderB@example.com' },
  });

  if (!senderB) {
    senderB = await prisma.sender.create({
      data: {
        userId: user.id,
        email: 'senderB@example.com',
        displayName: 'Sender Beta',
        smtpHost: config.ethereal.host,
        smtpPort: config.ethereal.port,
        smtpUser: config.ethereal.user,
        smtpPassword: config.ethereal.pass,
      },
    });
    console.log(`[Seed] Created Sender B: ${senderB.id} (${senderB.email})`);
  } else {
    senderB = await prisma.sender.update({
      where: { id: senderB.id },
      data: {
        smtpHost: config.ethereal.host,
        smtpPort: config.ethereal.port,
        smtpUser: config.ethereal.user,
        smtpPassword: config.ethereal.pass,
      },
    });
    console.log(`[Seed] Updated Sender B: ${senderB.id} (${senderB.email})`);
  }

  // 4. Ensure Sender Invalid (For SMTP failure & retry testing) exists
  let senderInvalid = await prisma.sender.findFirst({
    where: { userId: user.id, email: 'invalid_smtp@example.com' },
  });

  if (!senderInvalid) {
    senderInvalid = await prisma.sender.create({
      data: {
        userId: user.id,
        email: 'invalid_smtp@example.com',
        displayName: 'Invalid SMTP Sender',
        smtpHost: 'invalid.smtp.domain.test',
        smtpPort: 587,
        smtpUser: 'invalid_user',
        smtpPassword: 'invalid_password',
      },
    });
    console.log(`[Seed] Created Invalid Sender: ${senderInvalid.id} (${senderInvalid.email})`);
  }

  console.log('[Seed] Seed completed successfully.');
  console.log('==================================================');
  console.log(`Development User ID:   ${user.id}`);
  console.log(`Sender A ID:           ${senderA.id} (${senderA.email})`);
  console.log(`Sender B ID:           ${senderB.id} (${senderB.email})`);
  console.log(`Invalid Sender ID:     ${senderInvalid.id} (${senderInvalid.email})`);
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
