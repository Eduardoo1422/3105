import { db } from '../db';
import { FeatureService, ResourceService, StorageService, CategoryService, ConfigService } from '../services/data.service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

describe('ZROK Live Integration Flow (Backend -> DB -> API -> App Data)', () => {
  let testCategory: any;
  let testFeature: any;
  let testResource: any;
  const magic = Buffer.from('3105PATCH\0');

  beforeAll(async () => {
    // Ensure test category exists
    testCategory = await CategoryService.create({
      name: 'Integration Test Category',
      slug: 'integration-test-' + Date.now(),
      enabled: true
    });
  });

  afterAll(async () => {
    // Clean up test data from real DB and storage
    if (testFeature) {
      try {
        await db.feature.delete({ where: { id: testFeature.id } });
      } catch {}
    }
    if (testCategory) {
      try {
        await db.category.delete({ where: { id: testCategory.id } });
      } catch {}
    }
  });

  it('1 & 2. Create patch (feature) & upload .3105 resource via backend service layer', async () => {
    // Create feature with status GREEN
    testFeature = await FeatureService.create({
      name: 'Test Aimbot Pro',
      description: 'Live integration test patch',
      categoryId: testCategory.id,
      iconName: 'scope',
      enabled: true,
      status: 'GREEN'
    });

    expect(testFeature).toBeDefined();
    expect(testFeature.id).toBeDefined();
    expect(testFeature.status).toBe('GREEN');

    // Create real .3105 buffer with magic bytes
    const patchBytes = Buffer.concat([magic, Buffer.from(JSON.stringify({ test: true }))]);
    const { storageKey, sha256 } = await StorageService.saveFile(patchBytes);

    // Save resource
    testResource = await ResourceService.create({
      featureId: testFeature.id,
      filename: 'test-patch.3105',
      mimeType: 'application/octet-stream',
      fileSize: patchBytes.length,
      sha256,
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: 'Documents/test.plist',
      targetFilename: 'test.plist',
      storageKey
    });

    expect(testResource).toBeDefined();
    expect(testResource.id).toBeDefined();
    expect(testResource.sha256).toBe(sha256);
  });

  it('3 & 4. Confirm persistence in PostgreSQL & published config / bootstrap availability', async () => {
    // Query database directly to confirm persistence
    const dbFeature = await db.feature.findUnique({
      where: { id: testFeature.id },
      include: { category: true, resources: { include: { versions: true } } }
    });

    expect(dbFeature).not.toBeNull();
    expect(dbFeature?.name).toBe('Test Aimbot Pro');
    expect(dbFeature?.status).toBe('GREEN');
    expect(dbFeature?.resources.length).toBe(1);

    // Bootstrap data availability
    const allFeatures = await FeatureService.getAll();
    const found = allFeatures.find(f => f.id === testFeature.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe('GREEN');
  });

  it('8. Change patch status to YELLOW and RED, confirming updates', async () => {
    // Update to YELLOW
    const updatedYellow = await db.feature.update({
      where: { id: testFeature.id },
      data: { status: 'YELLOW' }
    });
    expect(updatedYellow.status).toBe('YELLOW');

    // Update to RED
    const updatedRed = await db.feature.update({
      where: { id: testFeature.id },
      data: { status: 'RED' }
    });
    expect(updatedRed.status).toBe('RED');

    // Revert to GREEN for download test
    await db.feature.update({
      where: { id: testFeature.id },
      data: { status: 'GREEN' }
    });
  });

  it('10. Verify resource download file retrieval and SHA-256 match', async () => {
    const resourceWithVersion = await ResourceService.getResourceWithLatestVersion(testResource.id);
    expect(resourceWithVersion).not.toBeNull();
    const version = resourceWithVersion?.versions?.[0];
    expect(version).toBeDefined();

    const filePath = StorageService.getFilePath(version!.storageKey);
    expect(fs.existsSync(filePath)).toBe(true);

    const fileBuffer = fs.readFileSync(filePath);
    const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    expect(computedHash).toBe(testResource.sha256);
  });
});
