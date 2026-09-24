import { db } from '../db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { LicenseStatus } from '@prisma/client';

export class LicenseService {
  static async createLicense(durationDays: number, maxDevices: number, notes?: string, adminId?: string) {
    const rawKey = crypto.randomUUID().split('-')[0];
    const keyHash = await bcrypt.hash(rawKey, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const license = await db.licenseKey.create({
      data: {
        keyIdentifier: rawKey,
        keyHash,
        expiresAt,
        maxDevices,
        notes,
        createdBy: adminId,
      }
    });

    return { id: license.id, rawKey };
  }

  static async validateLicense(keyIdentifier: string, rawSecret: string, deviceIdentifier: string) {
    const license = await db.licenseKey.findUnique({ where: { keyIdentifier } });
    if (!license || license.status !== LicenseStatus.ACTIVE || new Date() > license.expiresAt) throw new Error('Invalid license');

    if (!(await bcrypt.compare(rawSecret, license.keyHash))) throw new Error('Invalid license');

    const deviceCount = await db.device.count({ where: { licenseKeyId: license.id, active: true } });
    
    let device = await db.device.findUnique({
      where: { deviceIdentifier_licenseKeyId: { deviceIdentifier, licenseKeyId: license.id } }
    });

    if (!device) {
      if (deviceCount >= license.maxDevices) throw new Error('Device limit reached');
      device = await db.device.create({
        data: { deviceIdentifier, licenseKeyId: license.id }
      });
    }
    
    await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

    return { licenseId: license.id, deviceId: device.id };
  }
}
