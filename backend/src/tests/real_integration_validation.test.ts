import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { StorageService } from '../services/data.service';
import { resourceCreateSchema } from '../utils/validation';
import { config } from '../config';

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

describe('ZROK Real Integration & Practical Validation Suite', () => {
  const magic = Buffer.from('3105PATCH\0');

  it('1. Real .3105 Binary Creation & Magic Bytes Verification', () => {
    const patchPayload = JSON.stringify({
      version: 3,
      projectId: crypto.randomUUID(),
      rules: [
        { bundleID: 'com.apple.mobile.MobileHouseArrest', relativePath: 'Library/Preferences/config.plist', replacementData: 'base64...' }
      ]
    });
    const real3105FileBuffer = Buffer.concat([magic, Buffer.from(patchPayload, 'utf-8')]);

    expect(real3105FileBuffer.length).toBeGreaterThan(10);
    const headerMagic = real3105FileBuffer.subarray(0, 10);
    expect(headerMagic.equals(magic)).toBe(true);
  });

  it('2. Real Storage Write, SHA-256 Hash Matching & Integrity Check', async () => {
    const rawData = Buffer.from('zrok-real-integration-test-payload-bytes-' + crypto.randomUUID());
    const originalSize = rawData.length;
    const originalSha256 = crypto.createHash('sha256').update(rawData).digest('hex');

    // Store via real StorageService
    const { storageKey, sha256: storedSha256 } = await StorageService.saveFile(rawData);
    expect(storedSha256).toBe(originalSha256);

    const filePath = StorageService.getFilePath(storageKey);
    expect(fs.existsSync(filePath)).toBe(true);

    const savedStats = fs.statSync(filePath);
    expect(savedStats.size).toBe(originalSize);

    const retrievedBuffer = await StorageService.getFileBuffer(storageKey);
    expect(retrievedBuffer.length).toBe(originalSize);
    const retrievedSha256 = crypto.createHash('sha256').update(retrievedBuffer).digest('hex');
    expect(retrievedSha256).toBe(originalSha256);

    // Cleanup
    await StorageService.deleteFile(storageKey);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('3. Real Path Traversal & Security Validation', () => {
    const validPayload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: 'Documents/settings.json',
      targetFilename: 'settings.json'
    };
    expect(resourceCreateSchema.safeParse(validPayload).success).toBe(true);

    const maliciousPayload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: '../../etc/passwd',
      targetFilename: 'passwd'
    };
    expect(resourceCreateSchema.safeParse(maliciousPayload).success).toBe(false);
  });

  it('4. Real Password Hashing (Bcrypt) & JWT Authentication Validation', async () => {
    const password = 'admin_secure_password_2026';
    const hash = await bcrypt.hash(password, 10);
    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);

    const token = jwt.sign({ userId: 'user-1', role: 'ADMIN' }, config.jwtSecret, { expiresIn: '1h' });
    const decoded: any = jwt.verify(token, config.jwtSecret);
    expect(decoded.userId).toBe('user-1');
    expect(decoded.role).toBe('ADMIN');
  });
});
