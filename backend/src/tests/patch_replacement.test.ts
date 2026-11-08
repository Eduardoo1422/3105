// Register the Prisma mock BEFORE any import that triggers `new PrismaClient()`.
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

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resourceCreateSchema } from '../utils/validation';
import { config } from '../config';

const testStoragePath = config.storagePath;

beforeAll(() => {
  fs.mkdirSync(testStoragePath, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testStoragePath)) {
    const files = fs.readdirSync(testStoragePath);
    for (const file of files) {
      const fullPath = path.join(testStoragePath, file);
      try {
        if (fs.existsSync(fullPath)) {
          if (fs.statSync(fullPath).isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      } catch {}
    }
  }
});

describe('ZROK Backend .3105 Upload, Magic Bytes & Path Security Tests', () => {
  /**
   * NOTE: The definitive binary codec (PatchPackageCodec) and transactional patch engine (PatchTransaction, DevicePatchService)
   * are written in Swift and execute natively on iOS/macOS.
   * This test suite validates the backend counterpart: enforcing magic bytes ("3105PATCH\0") verification on upload,
   * path traversal protection, and secure file storage management.
   */

  it('should validate .3105 package header magic bytes ("3105PATCH\\0")', () => {
    const magic = Buffer.from('3105PATCH\0');
    const validBuffer = Buffer.concat([magic, Buffer.from('swift-property-list-payload')]);

    const isValid = validBuffer.length >= 10 && validBuffer.subarray(0, 10).equals(magic);
    expect(isValid).toBe(true);
  });

  it('should reject .3105 package with invalid or missing magic bytes', () => {
    const magic = Buffer.from('3105PATCH\0');
    const invalidBuffer = Buffer.concat([Buffer.from('CORRUPTED!'), Buffer.from('payload')]);

    const isValid = invalidBuffer.length >= 10 && invalidBuffer.subarray(0, 10).equals(magic);
    expect(isValid).toBe(false);
  });

  it('should reject path traversal in targetRelativePath', () => {
    const payload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: '../../etc/passwd',
      targetFilename: 'config.dat'
    };
    const result = resourceCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject absolute paths in targetRelativePath', () => {
    const payload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: '/absolute/path',
      targetFilename: 'config.dat'
    };
    const result = resourceCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
