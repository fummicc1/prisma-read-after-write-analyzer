# Examples

This document provides detailed examples of patterns that the Prisma Read-After-Write Analyzer can detect and how to fix them.

## Table of Contents

1. [Basic Write-Read Pattern](#basic-write-read-pattern)
2. [Explicit Replica Usage](#explicit-replica-usage)
3. [Correct Usage with $primary()](#correct-usage-with-primary)
4. [Transactions (Always Safe)](#transactions-always-safe)
5. [Multiple Operations](#multiple-operations)
6. [Read-Only Operations](#read-only-operations)

## Basic Write-Read Pattern

### ❌ Problem

```typescript
async function createAndReadUser() {
  // Write to primary database
  const newUser = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john@example.com'
    },
  });

  // This read will go to replica by default
  // May not see the newly created user due to replication lag!
  const users = await prisma.user.findMany({
    where: { email: 'john@example.com' },
  });

  return { newUser, users };
}
```

**Issue**: The `findMany` operation might read from a replica that hasn't yet received the newly created user.

### ✅ Solution

```typescript
async function createAndReadUser() {
  const newUser = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john@example.com'
    },
  });

  // Use $primary() to ensure we read from the primary database
  const users = await prisma.$primary().user.findMany({
    where: { email: 'john@example.com' },
  });

  return { newUser, users };
}
```

## Explicit Replica Usage

### ❌ Problem

```typescript
async function updateAndReadWithReplica() {
  // Update on primary
  await prisma.user.update({
    where: { id: 1 },
    data: { name: 'Jane Doe' },
  });

  // Explicitly reading from replica after write
  // This is even more problematic as it's intentional!
  const user = await prisma.$replica().user.findUnique({
    where: { id: 1 },
  });

  return user;
}
```

**Issue**: Explicitly using `$replica()` after a write operation guarantees reading potentially stale data.

### ✅ Solution

```typescript
async function updateAndReadSafely() {
  await prisma.user.update({
    where: { id: 1 },
    data: { name: 'Jane Doe' },
  });

  // Read from primary to get the latest data
  const user = await prisma.$primary().user.findUnique({
    where: { id: 1 },
  });

  return user;
}
```

## Correct Usage with $primary()

### ✅ Already Correct

```typescript
async function createAndReadWithPrimary() {
  const newUser = await prisma.user.create({
    data: {
      name: 'Alice',
      email: 'alice@example.com'
    },
  });

  // Using $primary() ensures we read from the primary database
  const users = await prisma.$primary().user.findMany({
    where: { email: 'alice@example.com' },
  });

  return { newUser, users };
}
```

**No issues detected** - This pattern correctly uses `$primary()` for the read operation.

## Transactions (Always Safe)

### ✅ Transactions Use Primary

```typescript
async function transactionExample() {
  const result = await prisma.$transaction(async (tx) => {
    // Create on primary (transaction always uses primary)
    const newUser = await tx.user.create({
      data: {
        name: 'Bob',
        email: 'bob@example.com'
      },
    });

    // Read also uses primary (no $primary() needed in transactions)
    const users = await tx.user.findMany({
      where: { email: 'bob@example.com' },
    });

    return { newUser, users };
  });

  return result;
}
```

**No issues detected** - All operations within a transaction automatically use the primary database.

## Multiple Operations

### ❌ Problem

```typescript
async function multipleOperations() {
  // First write
  await prisma.user.create({
    data: {
      name: 'Charlie',
      email: 'charlie@example.com'
    },
  });

  // Issue 1: Read after create
  const user1 = await prisma.user.findFirst({
    where: { email: 'charlie@example.com' },
  });

  // Second write
  await prisma.user.update({
    where: { id: user1?.id },
    data: { name: 'Charlie Updated' },
  });

  // Issue 2: Read after update
  const user2 = await prisma.user.findUnique({
    where: { id: user1?.id },
  });

  return { user1, user2 };
}
```

**Issues**: Two separate write → read patterns detected.

### ✅ Solution

```typescript
async function multipleOperationsSafe() {
  await prisma.user.create({
    data: {
      name: 'Charlie',
      email: 'charlie@example.com'
    },
  });

  // Use $primary() after write
  const user1 = await prisma.$primary().user.findFirst({
    where: { email: 'charlie@example.com' },
  });

  await prisma.user.update({
    where: { id: user1?.id },
    data: { name: 'Charlie Updated' },
  });

  // Use $primary() after write
  const user2 = await prisma.$primary().user.findUnique({
    where: { id: user1?.id },
  });

  return { user1, user2 };
}
```

## Read-Only Operations

### ✅ No Issues with Read-Only

```typescript
async function readOnlyOperations() {
  // All read operations - can safely use replicas
  const users = await prisma.user.findMany();
  const userCount = await prisma.user.count();
  const user = await prisma.user.findUnique({
    where: { id: 1 }
  });

  return { users, userCount, user };
}
```

**No issues detected** - When there are no write operations, using replicas for reads is perfectly safe and recommended for performance.

## Best Practices

### 1. Use Transactions When Possible

```typescript
// ✅ Preferred: Use transactions
async function safePattern() {
  return await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name: 'Test' } });
    const found = await tx.user.findUnique({ where: { id: created.id } });
    return { created, found };
  });
}
```

### 2. Explicitly Use $primary() After Writes

```typescript
// ✅ Good: Explicit primary reads
async function explicitPrimary() {
  await prisma.user.create({ data: { name: 'Test' } });
  return await prisma.$primary().user.findMany();
}
```

### 3. Separate Write and Read Operations

```typescript
// ✅ Good: Separate concerns when reads don't need immediate consistency
async function separatedOperations() {
  // Write operation
  await prisma.user.create({ data: { name: 'Test' } });

  // If reading unrelated data, replica is fine
  const allUsers = await prisma.user.findMany();

  return allUsers;
}
```

### 4. Document Your Intentions

```typescript
// ✅ Good: Comment why replica is acceptable
async function documentedChoice() {
  await prisma.user.create({ data: { name: 'Test' } });

  // OK to use replica here because we're reading aggregate statistics
  // that don't require strict consistency
  const count = await prisma.user.count();

  return count;
}
```

## Common Pitfalls

### 1. Forgetting About Eventual Consistency

```typescript
// ❌ Assuming immediate consistency
async function assumingConsistency() {
  const user = await prisma.user.create({
    data: { email: 'test@example.com' }
  });

  // This might not find the user!
  const exists = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });

  return exists !== null;
}
```

### 2. Using Replica for Critical Reads

```typescript
// ❌ Using replica for security-critical operations
async function criticalRead(userId: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: true }
  });

  // Don't check admin status from replica!
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (user?.isAdmin) {
    // Grant admin access...
  }
}
```

### 3. Cascading Inconsistencies

```typescript
// ❌ Chain of operations with inconsistent reads
async function cascadingIssues() {
  const order = await prisma.order.create({
    data: { total: 100 }
  });

  // Might not see the order yet
  const orderCount = await prisma.order.count();

  // Using potentially wrong count
  await prisma.stats.update({
    where: { id: 1 },
    data: { totalOrders: orderCount }
  });
}
```

## Summary

The key principle is: **After any write operation, use `$primary()` for subsequent reads that need to see those changes**. If your reads can tolerate eventual consistency (analytics, non-critical data, etc.), then using replicas is fine and improves performance.
