import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';

// Initialize Prisma with read replica extension
const prisma = new PrismaClient().$extends(
  readReplicas({
    url: 'postgresql://replica.example.com:5432/db',
  })
);

// ❌ Issue: Write followed by read (will use replica by default)
async function createAndReadUser() {
  const newUser = await prisma.user.create({
    data: { name: 'John Doe', email: 'john@example.com' },
  });

  // This read will go to replica, might not see the newly created user
  const users = await prisma.user.findMany({
    where: { email: 'john@example.com' },
  });

  return { newUser, users };
}

// ❌ Issue: Write followed by explicit replica read
async function updateAndReadWithReplica() {
  await prisma.user.update({
    where: { id: 1 },
    data: { name: 'Jane Doe' },
  });

  // Explicitly using replica after write
  const user = await prisma.$replica().user.findUnique({
    where: { id: 1 },
  });

  return user;
}

// ✅ OK: Write followed by primary read
async function createAndReadWithPrimary() {
  const newUser = await prisma.user.create({
    data: { name: 'Alice', email: 'alice@example.com' },
  });

  // Using $primary() to ensure we read from primary
  const users = await prisma.$primary().user.findMany({
    where: { email: 'alice@example.com' },
  });

  return { newUser, users };
}

// ✅ OK: Transaction (always uses primary)
async function transactionExample() {
  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { name: 'Bob', email: 'bob@example.com' },
    });

    // This is OK because transactions always use primary
    const users = await tx.user.findMany({
      where: { email: 'bob@example.com' },
    });

    return { newUser, users };
  });

  return result;
}

// ❌ Issue: Multiple writes and reads
async function multipleOperations() {
  // First write
  await prisma.user.create({
    data: { name: 'Charlie', email: 'charlie@example.com' },
  });

  // First read (issue)
  const user1 = await prisma.user.findFirst({
    where: { email: 'charlie@example.com' },
  });

  // Second write
  await prisma.user.update({
    where: { id: user1?.id },
    data: { name: 'Charlie Updated' },
  });

  // Second read (issue)
  const user2 = await prisma.user.findUnique({
    where: { id: user1?.id },
  });

  return { user1, user2 };
}

export {
  createAndReadUser,
  updateAndReadWithReplica,
  createAndReadWithPrimary,
  transactionExample,
  multipleOperations,
};
