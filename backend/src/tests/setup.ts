// Test setup - ensures environment variables exist for tests.
// Runs in `setupFiles`, i.e. before the test framework and before any test
// module is imported. This matters because `src/config/index.ts` parses the
// environment ONCE at import time, so these variables must be set first.
process.env.DATABASE_URL =
  'postgresql://test:test@localhost:5432/test_swag_external?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-key-with-at-least-32-chars';
process.env.STORAGE_PATH = '/tmp/opencode/swag-test-storage';
process.env.MAX_UPLOAD_SIZE = '10485760'; // 10MB
process.env.API_PORT = '3000';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_ADMIN_IDS = '';

// The real Prisma client is mocked per-test-file via `jest.mock`, so tests
// never connect to the database configured above. The dummy DATABASE_URL
// exists only to satisfy the Zod schema validation in `config/index.ts`.

const fs = require('fs');
const path = require('path');

// Ensure a clean, single storage directory for all tests. Every part of the
// suite reads this path from `config.storagePath`, so there must be no second,
// conflicting value overriding `process.env.STORAGE_PATH` after the config is
// parsed.
const storagePath = process.env.STORAGE_PATH!;
try {
  if (fs.existsSync(storagePath)) {
    const entries = fs.readdirSync(storagePath);
    for (const entry of entries) {
      const full = path.join(storagePath, entry);
      if (fs.statSync(full).isFile()) fs.unlinkSync(full);
    }
  }
  fs.mkdirSync(storagePath, { recursive: true });
} catch (e) {
  // Surface as a clear error so misconfigured tests fail loudly.
  throw new Error(`Failed to initialize test storage path ${storagePath}: ${(e as Error).message}`);
}
