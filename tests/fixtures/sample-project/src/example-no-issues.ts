import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';

const prisma = new PrismaClient().$extends(
  readReplicas({
    url: 'postgresql://replica.example.com:5432/db',
  })
);

// ✅ OK: Only read operations (can safely use replica)
async function readOnlyOperations() {
  const users = await prisma.user.findMany();
  const userCount = await prisma.user.count();
  const user = await prisma.user.findUnique({ where: { id: 1 } });

  return { users, userCount, user };
}

// ✅ OK: Write followed by $primary() read
async function safeWriteAndRead() {
  await prisma.user.create({
    data: { name: 'Test User', email: 'test@example.com' },
  });

  const users = await prisma.$primary().user.findMany({
    where: { email: 'test@example.com' },
  });

  return users;
}

// ✅ OK: Separate functions with no temporal relationship
async function writeData() {
  return await prisma.user.create({
    data: { name: 'Async User', email: 'async@example.com' },
  });
}

async function readData() {
  // This is in a different function and might be called separately
  // so it's not necessarily a read-after-write issue
  return await prisma.$primary().user.findMany();
}

export { readOnlyOperations, safeWriteAndRead, writeData, readData };
