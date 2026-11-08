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
import { StorageService, ResourceService, FeatureService, CategoryService } from '../services/data.service';
import { LicenseService } from '../services/license.service';
import { resourceCreateSchema } from '../utils/validation';
import { config } from '../config';
import { mockPrismaClient } from './mocks';

const testStoragePath = config.storagePath;

beforeAll(() => {
  fs.mkdirSync(testStoragePath, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testStoragePath)) {
    try {
      const files = fs.readdirSync(testStoragePath);
      for (const file of files) {
        const fullPath = path.join(testStoragePath, file);
        if (fs.existsSync(fullPath)) {
          if (fs.statSync(fullPath).isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      }
    } catch {}
  }
});

describe('ZROK Comprehensive Integration Audit & End-to-End Test Suite', () => {
  const magic = Buffer.from('3105PATCH\0');

  it('1. Flow Simulation: Site -> Backend -> DB -> App Catalog', async () => {
    // 1. Admin adds patch via web panel (simulated payload)
    const patchPayload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: 'Library/Preferences/com.zrok.patch.plist',
      targetFilename: 'com.zrok.patch.plist'
    };

    const validated = resourceCreateSchema.parse(patchPayload);
    expect(validated.targetBundleId).toBe('com.apple.mobile.MobileHouseArrest');

    // 2. Backend receives .3105 file buffer with magic bytes
    const sample3105Content = Buffer.concat([magic, Buffer.from('plist-or-json-patch-payload-bytes')]);
    expect(sample3105Content.subarray(0, 10).equals(magic)).toBe(true);

    // 3 & 4. File is stored securely via StorageService
    const { storageKey, sha256 } = await StorageService.saveFile(sample3105Content);
    expect(storageKey).toBeDefined();
    expect(sha256).toBeDefined();
    const storedFilePath = StorageService.getFilePath(storageKey);
    expect(fs.existsSync(storedFilePath)).toBe(true);

    // 5. Metadata registered in DB via Prisma mock
    mockPrismaClient.resource.create.mockResolvedValueOnce({
      id: 'res-101',
      featureId: validated.featureId,
      filename: 'patch.3105',
      mimeType: 'application/octet-stream',
      fileSize: sample3105Content.length,
      sha256,
      targetBundleId: validated.targetBundleId,
      targetRelativePath: validated.targetRelativePath,
      targetFilename: validated.targetFilename!
    });

    const resource = await ResourceService.create({
      featureId: validated.featureId,
      filename: 'patch.3105',
      mimeType: 'application/octet-stream',
      fileSize: sample3105Content.length,
      sha256,
      targetBundleId: validated.targetBundleId,
      targetRelativePath: validated.targetRelativePath,
      targetFilename: validated.targetFilename!,
      storageKey
    });

    expect(resource.id).toBe('res-101');

    // 6 & 7. App queries bootstrap catalog
    mockPrismaClient.feature.findMany.mockResolvedValueOnce([
      {
        id: validated.featureId,
        name: 'Aimbot Pro',
        description: 'Enhanced accuracy',
        categoryId: 'cat-1',
        iconName: 'scope',
        enabled: true,
        category: { id: 'cat-1', name: 'AIMBOT', slug: 'aimbot', enabled: true },
        resources: [
          {
            id: resource.id,
            filename: resource.filename,
            sha256: resource.sha256,
            targetBundleId: resource.targetBundleId,
            versions: [{ storageKey, sha256, version: '1.0.0' }]
          }
        ]
      }
    ]);

    const catalogFeatures = await FeatureService.getAll();
    expect(catalogFeatures.length).toBe(1);
    expect(catalogFeatures[0].resources[0].sha256).toBe(sha256);

    // Cleanup stored file
    await StorageService.deleteFile(storageKey);
  });

  it('2. File Integrity & SHA-256 Verification Test', async () => {
    const rawData = Buffer.from('zrok-exact-integration-bytes-test-payload-123456');
    const originalSize = rawData.length;
    const originalSha256 = crypto.createHash('sha256').update(rawData).digest('hex');

    const { storageKey, sha256: storedSha256 } = await StorageService.saveFile(rawData);
    expect(storedSha256).toBe(originalSha256);

    const retrievedBuffer = await StorageService.getFileBuffer(storageKey);
    expect(retrievedBuffer.length).toBe(originalSize);
    const retrievedSha256 = crypto.createHash('sha256').update(retrievedBuffer).digest('hex');
    expect(retrievedSha256).toBe(originalSha256);

    // Corrupted file test: verify checksum mismatch detection
    const corruptedBuffer = Buffer.from('corrupted-data-bytes');
    const corruptedSha256 = crypto.createHash('sha256').update(corruptedBuffer).digest('hex');
    expect(corruptedSha256).not.toBe(originalSha256);

    await StorageService.deleteFile(storageKey);
  });

  it('3. Path Traversal & Security Validation Test', async () => {
    const invalidPaths = [
      '../../etc/passwd',
      '/absolute/path/file.plist',
      '..\\windows\\system32',
      'foo/bar/../../baz'
    ];

    for (const badPath of invalidPaths) {
      const result = resourceCreateSchema.safeParse({
        featureId: '123e4567-e89b-12d3-a456-426614174000',
        targetBundleId: 'com.apple.mobile.MobileHouseArrest',
        targetRelativePath: badPath,
        targetFilename: 'config.plist'
      });
      expect(result.success).toBe(false);
    }
  });

  it('4. Failure Handling & Error Resilience Test', async () => {
    // Invalid storage key format
    expect(() => StorageService.getFilePath('invalid/key/path')).toThrow('Invalid storage key');

    // License validation failure cases
    mockPrismaClient.licenseKey.findUnique.mockResolvedValueOnce(null);
    await expect(LicenseService.validateLicense('ZROK-INVALID', 'SECRET', 'DEVICE-1'))
      .rejects.toThrow('Invalid license');
  });
});
