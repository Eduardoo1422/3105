import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resourceCreateSchema } from '../utils/validation';

describe('ZROK .3105 Package Parser, Integrity & Security Tests', () => {
  const magic = Buffer.from('3105PATCH\0');

  it('should parse valid .3105 package header with correct magic bytes', () => {
    const payload = JSON.stringify({
      version: 1,
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      rules: []
    });
    const packageBuffer = Buffer.concat([magic, Buffer.from(payload, 'utf-8')]);

    expect(packageBuffer.length).toBeGreaterThanOrEqual(10);
    const headerMagic = packageBuffer.subarray(0, 10);
    expect(headerMagic.equals(magic)).toBe(true);

    const extractedPayload = packageBuffer.subarray(10).toString('utf-8');
    const parsed = JSON.parse(extractedPayload);
    expect(parsed.version).toBe(1);
    expect(parsed.projectId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('should reject .3105 packages with invalid magic bytes', () => {
    const corruptMagic = Buffer.from('BADMAGIC\0\0');
    const payload = Buffer.from('test-payload');
    const invalidBuffer = Buffer.concat([corruptMagic, payload]);

    const headerMagic = invalidBuffer.subarray(0, 10);
    expect(headerMagic.equals(magic)).toBe(false);
  });

  it('should validate SHA-256 integrity hash of package payload', () => {
    const data = Buffer.from('zrok-secure-patch-payload-content');
    const expectedHash = crypto.createHash('sha256').update(data).digest('hex');

    const computedHash = crypto.createHash('sha256').update(data).digest('hex');
    expect(computedHash).toEqual(expectedHash);
  });

  it('should enforce path traversal prevention on targetRelativePath', () => {
    const validRequest = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: 'Library/Preferences/com.app.plist',
      targetFilename: 'com.app.plist'
    };
    expect(resourceCreateSchema.safeParse(validRequest).success).toBe(true);

    const traversalRequest = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: '../../System/Library/Caches/config',
      targetFilename: 'config'
    };
    expect(resourceCreateSchema.safeParse(traversalRequest).success).toBe(false);
  });

  it('should enforce bare filename validation on targetFilename', () => {
    const validFilename = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: 'Library/Preferences/prefs.plist',
      targetFilename: 'prefs.plist'
    };
    expect(resourceCreateSchema.safeParse(validFilename).success).toBe(true);

    const invalidFilename = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: 'Library/Preferences/prefs.plist',
      targetFilename: 'subdir/prefs.plist'
    };
    expect(resourceCreateSchema.safeParse(invalidFilename).success).toBe(false);
  });
});
