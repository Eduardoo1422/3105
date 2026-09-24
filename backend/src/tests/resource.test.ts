// Register the Prisma mock BEFORE any import that triggers `new PrismaClient()`.
// ts-jest hoists `jest.mock` above the import statements below, so by the time
// `src/db/index.ts` runs `new PrismaClient()` it receives `mockPrismaClient`
// instead of opening a real database connection.
jest.mock('@prisma/client', () => {
  const { mockPrismaClient } = require('./mocks');
  return {
    __esModule: true,
    PrismaClient: jest.fn(() => mockPrismaClient),
    LicenseStatus: {
      ACTIVE: 'ACTIVE',
      INACTIVE: 'INACTIVE',
      REVOKED: 'REVOKED',
      EXPIRED: 'EXPIRED',
    },
  };
});

import { ResourceService, StorageService } from '../services/data.service';
import { FeatureService } from '../services/data.service';
import { mockPrismaClient, defaultTransactionImpl } from './mocks';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

// Single source of truth for the storage directory used during tests.
// This MUST match `process.env.STORAGE_PATH` set in `src/tests/setup.ts` (which
// `config/index.ts` parses at import time). Deriving the path from `config`
// guarantees tests assert against the same directory the `StorageService`
// actually writes to.
const testStoragePath = config.storagePath;

// Ensure test storage dir exists before tests; clean it up after.
beforeAll(() => {
  fs.mkdirSync(testStoragePath, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testStoragePath)) {
    const files = fs.readdirSync(testStoragePath);
    for (const file of files) {
      fs.unlinkSync(path.join(testStoragePath, file));
    }
    fs.rmdirSync(testStoragePath);
  }
});

describe('StorageService', () => {
  describe('saveFile', () => {
    it('should save a file and return storageKey with SHA-256', async () => {
      const testData = Buffer.from('test file content');
      const expectedSha256 = crypto.createHash('sha256').update(testData).digest('hex');

      const result = await StorageService.saveFile(testData);

      expect(result.storageKey).toBeDefined();
      expect(typeof result.storageKey).toBe('string');
      expect(result.storageKey).toMatch(/^[a-f0-9\-]+$/);
      expect(result.sha256).toBe(expectedSha256);

      // File should exist within the configured storage path
      expect(fs.existsSync(path.join(testStoragePath, result.storageKey))).toBe(true);

      // Clean up
      fs.unlinkSync(path.join(testStoragePath, result.storageKey));
    });

    it('should generate unique storage keys for each file', async () => {
      const testData = Buffer.from('test file content');
      const result1 = await StorageService.saveFile(testData);
      const result2 = await StorageService.saveFile(testData);

      expect(result1.storageKey).not.toBe(result2.storageKey);

      // Clean up
      fs.unlinkSync(path.join(testStoragePath, result1.storageKey));
      fs.unlinkSync(path.join(testStoragePath, result2.storageKey));
    });

    it('should calculate correct SHA-256 hash', async () => {
      const testData = Buffer.from('known test data for hash verification');
      const result = await StorageService.saveFile(testData);

      const expectedSha256 = crypto.createHash('sha256').update(testData).digest('hex');
      expect(result.sha256).toBe(expectedSha256);

      // Clean up
      fs.unlinkSync(path.join(testStoragePath, result.storageKey));
    });

    it('should store files inside STORAGE_PATH (no traversal)', async () => {
      const testData = Buffer.from('containment check');
      const { storageKey } = await StorageService.saveFile(testData);

      const resolved = path.resolve(path.join(testStoragePath, storageKey));
      const resolvedStorage = path.resolve(testStoragePath);
      expect(resolved.startsWith(resolvedStorage + path.sep)).toBe(true);
      expect(resolved.endsWith(storageKey)).toBe(true);

      // Clean up
      fs.unlinkSync(path.join(testStoragePath, storageKey));
    });
  });

  describe('getFilePath', () => {
    it('should return valid file path for an existing file storage key', async () => {
      // saveFile generates a UUID storage key and writes the file to disk; only
      // a real, existing file should resolve to a valid path (this exercises
      // validateStorageKey + the existence + containment checks).
      const testData = Buffer.from('path check content');
      const { storageKey } = await StorageService.saveFile(testData);

      const result = StorageService.getFilePath(storageKey);
      expect(result).toContain(storageKey);
      expect(result).toContain(testStoragePath);
      expect(path.resolve(result).startsWith(path.resolve(testStoragePath) + path.sep)).toBe(true);

      // Clean up
      fs.unlinkSync(path.join(testStoragePath, storageKey));
    });

    it('should reject storage key with path traversal (../)', () => {
      expect(() => StorageService.getFilePath('../etc/passwd')).toThrow('Invalid storage key');
    });

    it('should reject storage key with forward slash', () => {
      expect(() => StorageService.getFilePath('file/name')).toThrow('Invalid storage key');
    });

    it('should reject storage key with backslash', () => {
      expect(() => StorageService.getFilePath('file\\name')).toThrow('Invalid storage key');
    });

    it('should reject empty storage key', () => {
      expect(() => StorageService.getFilePath('')).toThrow('Invalid storage key');
    });

    it('should reject non-UUID format storage key', () => {
      expect(() => StorageService.getFilePath('not-a-uuid-key')).toThrow('Invalid storage key');
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      const testData = Buffer.from('file to delete');
      const { storageKey } = await StorageService.saveFile(testData);

      const filePath = path.join(testStoragePath, storageKey);
      expect(fs.existsSync(filePath)).toBe(true);

      await StorageService.deleteFile(storageKey);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should throw error for invalid storage key', async () => {
      await expect(StorageService.deleteFile('../malicious')).rejects.toThrow('Invalid storage key');
    });
  });

  describe('getFileBuffer', () => {
    it('should retrieve file buffer by storage key', async () => {
      const testData = Buffer.from('file to retrieve');
      const { storageKey } = await StorageService.saveFile(testData);

      const retrieved = await StorageService.getFileBuffer(storageKey);
      expect(retrieved.toString()).toBe(testData.toString());

      // Clean up
      fs.unlinkSync(path.join(testStoragePath, storageKey));
    });

    it('should throw error for non-existent file', async () => {
      const validKey = '123e4567-e89b-12d3-a456-426614174000';
      await expect(StorageService.getFileBuffer(validKey)).rejects.toThrow('not found');
    });
  });
});

describe('ResourceService', () => {
  const validUUID = '123e4567-e89b-12d3-a456-426614174000';

  const mockResourceData = {
    featureId: 'feature-123',
    filename: 'test.zip',
    mimeType: 'application/zip',
    fileSize: 1024,
    sha256: 'abc123hash',
    targetBundleId: 'com.example.app',
    targetRelativePath: 'Library/Caches/test.zip',
    targetFilename: 'test.zip',
    storageKey: 'storage-key-123',
  };

  beforeEach(() => {
    // Full reset between tests (including mock implementations) for isolation,
    // then restore the default transactional behavior so the callback runs
    // against `mockPrismaClient` itself.
    jest.resetAllMocks();
    mockPrismaClient.$transaction.mockImplementation(defaultTransactionImpl);
  });

  describe('create', () => {
    it('should create Resource and ResourceVersion in a transaction', async () => {
      const mockResource = { id: 'resource-1', ...mockResourceData };
      const mockVersion = {
        id: 'version-1',
        ...mockResourceData,
        version: '1.0.0',
        resourceId: 'resource-1',
      };

      // Provide a transactional client whose model mocks are controlled per-test.
      mockPrismaClient.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          resource: {
            create: jest.fn().mockResolvedValue(mockResource),
          },
          resourceVersion: {
            create: jest.fn().mockResolvedValue(mockVersion),
          },
        };
        return callback(tx);
      });

      const result = await ResourceService.create(mockResourceData);
      expect(result).toEqual(mockResource);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should reject invalid featureId', async () => {
      // Simulate a foreign-key violation raised by the database when persisting.
      mockPrismaClient.resource.create.mockRejectedValue(new Error('Foreign key violation'));

      await expect(
        ResourceService.create({
          ...mockResourceData,
          featureId: 'non-existent-feature',
        })
      ).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should return resource with latest version', async () => {
      const mockResource = { id: 'resource-1', ...mockResourceData, versions: [] };
      mockPrismaClient.resource.findUnique.mockResolvedValue(mockResource);

      const result = await ResourceService.getById('resource-1');
      expect(mockPrismaClient.resource.findUnique).toHaveBeenCalledWith({
        where: { id: 'resource-1' },
        include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      expect(result).toEqual(mockResource);
    });

    it('should return null for non-existent resource', async () => {
      mockPrismaClient.resource.findUnique.mockResolvedValue(null);

      const result = await ResourceService.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getResourceWithLatestVersion', () => {
    it('should return resource with feature and latest version', async () => {
      const mockResource = {
        id: 'resource-1',
        ...mockResourceData,
        feature: { id: 'feature-123', name: 'Test Feature' },
        versions: [
          {
            version: '1.0.0',
            storageKey: 'storage-key-123',
            fileSize: 1024,
            sha256: 'abc123hash',
          },
        ],
      };
      mockPrismaClient.resource.findUnique.mockResolvedValue(mockResource);

      const result = await ResourceService.getResourceWithLatestVersion('resource-1');
      expect(result).toEqual(mockResource);
    });
  });

  describe('list', () => {
    it('should return all resources with latest version', async () => {
      const mockResources = [
        {
          id: 'resource-1',
          ...mockResourceData,
          feature: { id: 'feature-1' },
          versions: [],
        },
      ];
      mockPrismaClient.resource.findMany.mockResolvedValue(mockResources);

      const result = await ResourceService.list();
      expect(mockPrismaClient.resource.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockResources);
    });
  });
});
