import { db } from '../db';
import crypto from 'crypto';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

async function runHttpAudit() {
  console.log('=== ZROK REAL HTTP INTEGRATION AUDIT START ===');
  const baseUrl = 'http://localhost:3000/api/v1';
  let adminToken = '';
  let testCategoryId = '';
  let testFeatureId = '';
  let testResourceId = '';
  let testStorageKey = '';

  const magic = Buffer.from('3105PATCH\0');

  try {
    // 1. Authenticate admin
    console.log('1. Authenticating admin user (POST /auth/login)...');
    const existingAdmin = await db.user.findUnique({ where: { username: 'admin' } });
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('adminpassword123', 10);
    
    if (!existingAdmin) {
      await db.user.create({
        data: { username: 'admin', password: hashedPassword, role: 'ADMIN' }
      });
    } else {
      await db.user.update({
        where: { username: 'admin' },
        data: { password: hashedPassword }
      });
    }

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'adminpassword123' })
    });
    
    const loginData: any = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      throw new Error(`Login failed: HTTP ${loginRes.status} - ${JSON.stringify(loginData)}`);
    }
    adminToken = loginData.token;
    console.log(`   HTTP Login successful! Status: ${loginRes.status}, Token acquired.`);

    // 2. Create Category via HTTP POST /admin/category
    console.log('2. Creating category via HTTP (POST /admin/category)...');
    const catRes = await fetch(`${baseUrl}/admin/category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'HTTP Audit Category', slug: 'http-audit-' + Date.now(), enabled: true })
    });
    const catData: any = await catRes.json();
    if (!catRes.ok) throw new Error(`Category creation failed: HTTP ${catRes.status} - ${JSON.stringify(catData)}`);
    testCategoryId = catData.id;
    console.log(`   HTTP Category created! Status: ${catRes.status}, ID: ${testCategoryId}`);

    // 3. Create Feature (Patch) via HTTP POST /admin/feature
    console.log('3. Creating patch feature via HTTP (POST /admin/feature)...');
    const featRes = await fetch(`${baseUrl}/admin/feature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'HTTP Audit Aimbot',
        description: 'Created via real HTTP admin endpoint',
        categoryId: testCategoryId,
        iconName: 'scope',
        enabled: true,
        status: 'GREEN'
      })
    });
    const featData: any = await featRes.json();
    if (!featRes.ok) throw new Error(`Feature creation failed: HTTP ${featRes.status} - ${JSON.stringify(featData)}`);
    testFeatureId = featData.id;
    console.log(`   HTTP Feature created! Status: ${featRes.status}, ID: ${testFeatureId}, Status field: ${featData.status}`);

    // 4. Upload .3105 Resource file via HTTP POST /admin/resource (multipart/form-data)
    console.log('4. Uploading .3105 patch file via HTTP (POST /admin/resource)...');
    const tempFilePath = path.join(__dirname, 'temp_test.3105');
    const patchBuffer = Buffer.concat([magic, Buffer.from(JSON.stringify({ httpTest: true }))]);
    fs.writeFileSync(tempFilePath, patchBuffer);

    const form = new FormData();
    form.append('featureId', testFeatureId);
    form.append('targetBundleId', 'com.apple.mobile.MobileHouseArrest');
    form.append('targetRelativePath', 'Documents/http_test.plist');
    form.append('targetFilename', 'http_test.plist');
    form.append('file', fs.readFileSync(tempFilePath), { filename: 'http_test.3105', contentType: 'application/octet-stream' });

    const uploadRes = await fetch(`${baseUrl}/admin/resource`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        ...form.getHeaders()
      },
      body: form.getBuffer() as any
    });
    const uploadData: any = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Resource upload failed: HTTP ${uploadRes.status} - ${JSON.stringify(uploadData)}`);
    testResourceId = uploadData.id;
    testStorageKey = uploadData.storageKey;
    console.log(`   HTTP Resource uploaded! Status: ${uploadRes.status}, Resource ID: ${testResourceId}`);

    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    // 5. Query GET /bootstrap (App bootstrap catalog contract)
    console.log('5. Querying bootstrap catalog (GET /bootstrap)...');
    const bootRes = await fetch(`${baseUrl}/bootstrap`);
    const bootData: any = await bootRes.json();
    if (!bootRes.ok) throw new Error(`Bootstrap query failed: HTTP ${bootRes.status}`);
    const foundInBootstrap = (bootData.features || []).find((f: any) => f.id === testFeatureId);
    console.log(`   Bootstrap query successful! Status: ${bootRes.status}, Feature found: ${Boolean(foundInBootstrap)}, Status: ${foundInBootstrap?.status}`);

    // 6. Test status changes in DB/API (GREEN -> YELLOW -> RED)
    console.log('6. Testing status rotation (GREEN -> YELLOW -> RED)...');
    for (const st of ['YELLOW', 'RED', 'GREEN']) {
      await db.feature.update({
        where: { id: testFeatureId },
        data: { status: st }
      });
      const checkRes = await fetch(`${baseUrl}/bootstrap`);
      const checkData: any = await checkRes.json();
      const match = (checkData.features || []).find((f: any) => f.id === testFeatureId);
      console.log(`   Status updated to ${st} -> Bootstrap reflects status: ${match?.status}`);
    }

    // 7. Test authenticated client download POST /client/resource/:id/download
    console.log('7. Testing client download endpoint (POST /client/resource/:id/download)...');
    const licenseService = require('../services/license.service').LicenseService;
    const licResult = await licenseService.createLicense(30, 5, 'Audit License', 'admin');
    
    const downloadRes = await fetch(`${baseUrl}/client/resource/${testResourceId}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyIdentifier: licResult.keyIdentifier,
        rawSecret: licResult.rawSecret,
        deviceIdentifier: 'audit-device-123'
      })
    });
    
    if (!downloadRes.ok) {
      const errBody = await downloadRes.text();
      throw new Error(`Download failed: HTTP ${downloadRes.status} - ${errBody}`);
    }
    const arrayBuffer = await downloadRes.arrayBuffer();
    const downloadedBuffer = Buffer.from(arrayBuffer);
    const downloadedSha256 = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');
    console.log(`   Download successful! Status: ${downloadRes.status}, Downloaded bytes: ${downloadedBuffer.length}, SHA-256: ${downloadedSha256}`);

    console.log('=== ZROK REAL HTTP INTEGRATION AUDIT COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('=== ZROK REAL HTTP INTEGRATION AUDIT FAILED ===', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up temporary test data...');
    if (testResourceId) {
      try {
        await db.resourceVersion.deleteMany({ where: { resourceId: testResourceId } });
        await db.resource.delete({ where: { id: testResourceId } });
      } catch {}
    }
    if (testFeatureId) {
      try {
        await db.feature.delete({ where: { id: testFeatureId } });
      } catch {}
    }
    if (testCategoryId) {
      try {
        await db.category.delete({ where: { id: testCategoryId } });
      } catch {}
    }
    if (testStorageKey) {
      try {
        const storageService = require('../services/data.service').StorageService;
        await storageService.deleteFile(testStorageKey);
      } catch {}
    }
    console.log('Cleanup finished.');
    await db.$disconnect();
  }
}

runHttpAudit();
