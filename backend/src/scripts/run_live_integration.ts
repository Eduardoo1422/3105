import { db } from '../db';
import { FeatureService, ResourceService, StorageService, CategoryService } from '../services/data.service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function runLiveIntegration() {
  console.log('=== ZROK LIVE INTEGRATION VALIDATION START ===');
  const magic = Buffer.from('3105PATCH\0');

  let category: any;
  let feature: any;
  let resource: any;
  let storageKey: string = '';

  try {
    // 1. Verify PostgreSQL connection
    console.log('1. Verifying PostgreSQL connection via Prisma...');
    const userCount = await db.user.count();
    console.log(`   Connected! User count in DB: ${userCount}`);

    // 2. Create category & patch (feature) via backend service (same endpoint logic as web admin)
    console.log('2. Creating test category and patch (feature)...');
    category = await CategoryService.create({
      name: 'Live Audit Category',
      slug: 'live-audit-' + Date.now(),
      enabled: true
    });
    console.log(`   Created category ID: ${category.id}`);

    feature = await FeatureService.create({
      name: 'Live Aimbot Pro',
      description: 'Tested via live integration script',
      categoryId: category.id,
      iconName: 'scope',
      enabled: true,
      status: 'GREEN'
    });
    console.log(`   Created patch (feature) ID: ${feature.id}, Status: ${feature.status}`);

    // 3. Upload / save .3105 resource file
    console.log('3. Uploading real .3105 package with magic bytes...');
    const patchContent = Buffer.concat([magic, Buffer.from(JSON.stringify({ liveTest: true, timestamp: Date.now() }))]);
    const savedFile = await StorageService.saveFile(patchContent);
    storageKey = savedFile.storageKey;
    const sha256 = savedFile.sha256;
    console.log(`   File saved to storage key: ${storageKey}`);
    console.log(`   Computed SHA-256: ${sha256}`);

    resource = await ResourceService.create({
      featureId: feature.id,
      filename: 'live-test.3105',
      mimeType: 'application/octet-stream',
      fileSize: patchContent.length,
      sha256,
      targetBundleId: 'com.apple.mobile.MobileHouseArrest',
      targetRelativePath: 'Documents/live.plist',
      targetFilename: 'live.plist',
      storageKey
    });
    console.log(`   Persisted resource ID in DB: ${resource.id}`);

    // 4 & 5. Query bootstrap / published catalog
    console.log('4 & 5. Querying bootstrap catalog...');
    const bootstrapFeatures = await FeatureService.getAll();
    const publishedMatch = bootstrapFeatures.find(f => f.id === feature.id);
    if (!publishedMatch) {
      throw new Error('Published feature not found in bootstrap catalog!');
    }
    console.log(`   Found published patch in bootstrap: "${publishedMatch.name}" (Status: ${publishedMatch.status})`);

    // 8. Change status to GREEN -> YELLOW -> RED
    console.log('8. Testing status changes (GREEN -> YELLOW -> RED)...');
    for (const st of ['GREEN', 'YELLOW', 'RED'] as const) {
      await db.feature.update({
        where: { id: feature.id },
        data: { status: st }
      });
      const verified = await db.feature.findUnique({ where: { id: feature.id } });
      console.log(`   Status updated to ${st}: confirmed in DB as ${verified?.status}`);
    }

    // 10. Verify resource download file retrieval and SHA-256 match
    console.log('10. Verifying resource download file integrity...');
    const latestRes = await ResourceService.getResourceWithLatestVersion(resource.id);
    const version = latestRes?.versions?.[0];
    if (!version) throw new Error('Resource version not found');
    const filePath = StorageService.getFilePath(version.storageKey);
    const fileBytes = fs.readFileSync(filePath);
    const downloadedHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
    console.log(`   Original SHA-256: ${sha256}`);
    console.log(`   Downloaded SHA-256: ${downloadedHash}`);
    if (originalHashMatch(sha256, downloadedHash)) {
      console.log('   SHA-256 integrity match: PASSED');
    } else {
      throw new Error('SHA-256 mismatch!');
    }

    console.log('=== ZROK LIVE INTEGRATION VALIDATION SUCCESSFUL ===');
  } catch (err) {
    console.error('=== ZROK LIVE INTEGRATION VALIDATION FAILED ===', err);
    process.exit(1);
  } finally {
    // Cleanup test data in correct order (ResourceVersions -> Resources -> Feature -> Category -> Storage)
    console.log('Cleaning up test data...');
    if (resource) {
      try {
        await db.resourceVersion.deleteMany({ where: { resourceId: resource.id } });
        await db.resource.delete({ where: { id: resource.id } });
      } catch {}
    }
    if (feature) {
      try {
        await db.feature.delete({ where: { id: feature.id } });
      } catch {}
    }
    if (category) {
      try {
        await db.category.delete({ where: { id: category.id } });
      } catch {}
    }
    if (storageKey) {
      try {
        await StorageService.deleteFile(storageKey);
      } catch {}
    }
    console.log('Cleanup completed.');
    await db.$disconnect();
  }
}

function originalHashMatch(a: string, b: string): boolean {
  return a === b;
}

runLiveIntegration();
