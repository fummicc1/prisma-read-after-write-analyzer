# Prisma RAW（Read-After-Write） Analyzer

A static code analyzer for TypeScript projects using Prisma with read replicas. This tool detects potential read-after-write consistency issues where data might be read from a replica immediately after writing to the primary database.

## Problem Statement

When using Prisma with the `@prisma/extension-read-replicas` extension, read operations are automatically routed to read replicas by default. This can cause consistency issues when:

1. You write data to the primary database
2. Immediately read that data without explicitly using `$primary()`
3. The replica hasn't replicated the changes yet (replication lag)

This tool helps identify these problematic patterns in your codebase.

## Features

- Detects read-after-write patterns within function scopes
- Identifies operations that should use `$primary()` but don't
- Skips transaction operations (always use primary)
- Outputs results in JSON format
- TypeScript-based static analysis using ts-morph
- Zero runtime dependencies on your project

## Installation

```bash
npm install -g prisma-read-after-write-analyzer
```

Or use with npx:

```bash
npx prisma-read-after-write-analyzer <project-path>
```

## Usage

### Basic Usage

```bash
prisma-raw-analyzer /path/to/your/project
```

### With Options

```bash
prisma-raw-analyzer /path/to/your/project \
  --output results.json \
  --include "src/**/*.ts" \
  --exclude "**/*.test.ts"
```

### Options

- `-o, --output <file>` - Output file for JSON results (default: stdout)
- `-i, --include <patterns>` - Comma-separated glob patterns to include (default: `src/**/*.ts`)
- `-e, --exclude <patterns>` - Comma-separated glob patterns to exclude (default: `node_modules/**,dist/**,build/**`)
- `--max-depth <number>` - Maximum depth for call graph traversal (default: 100)

## Example Output

```json
{
  "summary": {
    "totalIssues": 2,
    "filesAnalyzed": 15,
    "executionTime": "0.45s"
  },
  "issues": [
    {
      "type": "read-after-write",
      "severity": "error",
      "writeOperation": {
        "method": "create",
        "model": "user",
        "file": "src/services/user.ts",
        "line": 15,
        "column": 10
      },
      "readOperation": {
        "method": "findMany",
        "model": "user",
        "file": "src/services/user.ts",
        "line": 20,
        "column": 10,
        "usesReplica": false,
        "usesPrimary": false
      },
      "callChain": [
        "src/services/user.ts:15",
        "src/services/user.ts:20"
      ],
      "message": "Read operation on user.findMany() may use replica immediately after write operation on user.create(), potentially reading stale data. Consider using $primary() for the read operation."
    }
  ]
}
```

## Detected Patterns

### L Problematic Pattern

```typescript
async function createUser() {
  // Write to primary
  await prisma.user.create({
    data: { name: 'John' }
  });

  // Read from replica (may not see the new user yet!)
  const users = await prisma.user.findMany({
    where: { name: 'John' }
  });
}
```

### Correct Pattern

```typescript
async function createUser() {
  // Write to primary
  await prisma.user.create({
    data: { name: 'John' }
  });

  // Read from primary (guaranteed to see the new user)
  const users = await prisma.$primary().user.findMany({
    where: { name: 'John' }
  });
}
```

### Also OK: Transactions

```typescript
async function createUser() {
  await prisma.$transaction(async (tx) => {
    // Both operations use primary
    await tx.user.create({
      data: { name: 'John' }
    });

    const users = await tx.user.findMany({
      where: { name: 'John' }
    });
  });
}
```

## How It Works

1. **Prisma Client Detection**: Identifies all PrismaClient instances and checks for read replica extensions
2. **Operation Classification**: Classifies Prisma operations as read or write
3. **Scope Analysis**: Analyzes operations within function scopes
4. **Pattern Detection**: Identifies RAW patterns that don't use `$primary()`
5. **JSON Output**: Generates a detailed report with all issues found

## Current Limitations

### Function Scope Only

The current MVP version analyzes RAW patterns **within the same function scope**. It does not yet track operations across function calls.

```typescript
// Currently detected
async function example1() {
  await prisma.user.create({ data: { name: 'John' } });
  const users = await prisma.user.findMany(); // Issue detected
}

// L Not yet detected (cross-function)
async function createUser() {
  return await prisma.user.create({ data: { name: 'John' } });
}

async function getUsers() {
  return await prisma.user.findMany(); // Issue NOT detected yet
}

async function example2() {
  await createUser();
  await getUsers(); // This relationship is not tracked yet
}
```

### Future Enhancements

- **Call Graph Analysis**: Track operations across function calls
- **Data Flow Analysis**: Follow data dependencies across the codebase
- **Control Flow Analysis**: Handle complex conditional logic
- **Configuration File**: Support for custom rules and patterns
- **Auto-fix**: Suggest or automatically add `$primary()` calls

## Development

### Prerequisites

- Node.js >= 20.4.0
- TypeScript project with tsconfig.json

### Building from Source

```bash
git clone <repository-url>
cd prisma-read-after-write-analyzer
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Related Resources

- [Prisma Read Replicas Extension](https://github.com/prisma/extension-read-replicas)
- [Prisma Documentation](https://www.prisma.io/docs)
- [ts-morph Documentation](https://ts-morph.com/)

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.
