// Mock Prisma client for tests.
//
// NOTE: The `jest.mock('@prisma/client', ...)` call is intentionally NOT
// placed in this module. ts-jest only hoists `jest.mock` within the file that
// contains it, so registering the mock here would be too late: the test file
// imports `data.service` (which triggers `new PrismaClient()` in `db/index.ts`)
// before this module is evaluated, resulting in a REAL database connection.
//
// Instead, each test file registers its own `jest.mock('@prisma/client', ...)`
// at the top (above imports) and builds this mock client on demand via
// `require('./mocks')`. This module only constructs and exports the singleton
// mock client and the default `$transaction` implementation used by the
// `ResourceService` tests.

const mockPrismaClient: Record<string, any> = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  licenseKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  device: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  feature: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  resource: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  resourceVersion: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

/**
 * Default `$transaction` behavior used by the `ResourceService` tests.
 *
 * Prisma's `$transaction(callback)` invokes the callback with a transactional
 * client. In tests we mirror this by running the callback with the same mock
 * client instance, so the model mocks configured on `mockPrismaClient` are
 * reused inside the transaction body (e.g. `resource.create`).
 */
const defaultTransactionImpl = async (callback: any) => callback(mockPrismaClient);

mockPrismaClient.$transaction.mockImplementation(defaultTransactionImpl);

export { mockPrismaClient, defaultTransactionImpl };
