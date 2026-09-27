import { db } from '../db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { LicenseStatus } from '@prisma/client';

export class LicenseService {
  static async createLicense(durationDays: number, maxDevices: number, notes?: string, adminId?: string) {
    const rawSecret = crypto.randomUUID().split('-')[0];
    const keyIdentifier = crypto.randomUUID().split('-')[0];
    const keyHash = await bcrypt.hash(rawSecret, 10);
    
    const license = await db.licenseKey.create({
      data: {
        keyIdentifier,
        keyHash,
        durationDays,
        status: LicenseStatus.ACTIVE,
        expiresAt: null,
        activatedAt: null,
        maxDevices,
        notes,
        createdBy: adminId,
      }
    });

    await db.auditLog.create({ data: { action: 'LICENSE_CREATED', targetId: license.id, actorId: adminId } });
    return { keyIdentifier: license.keyIdentifier, rawSecret };
  }

  static async validateLicense(keyIdentifier: string, rawSecret: string, deviceIdentifier: string) {
    return await db.$transaction(async (prismaTx) => {
      const license = await prismaTx.licenseKey.findUnique({ where: { keyIdentifier } });
      if (!license) throw new Error('Invalid license');
      if (license.status === LicenseStatus.REVOKED) throw new Error('License revoked');
      if (license.status === LicenseStatus.INACTIVE) throw new Error('License inactive');
      if (license.status === LicenseStatus.PAUSED) throw new Error('License paused');
      if (license.status === LicenseStatus.EXPIRED) throw new Error('License expired');
      
      if (!(await bcrypt.compare(rawSecret, license.keyHash))) throw new Error('Invalid license');

      // Deferred Activation
      if (!license.activatedAt) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (license.durationDays * 24 * 60 * 60 * 1000));
        
        const updated = await prismaTx.licenseKey.updateMany({
          where: { id: license.id, activatedAt: null },
          data: { activatedAt: now, expiresAt }
        });
        
        if (updated.count === 0) {
            const fresh = await prismaTx.licenseKey.findUnique({ where: { id: license.id } });
            if (!fresh || !fresh.expiresAt || new Date() > fresh.expiresAt) throw new Error('License expired');
        }
        await prismaTx.auditLog.create({ data: { action: 'LICENSE_ACTIVATED', targetId: license.id } });
      } else if (license.expiresAt && new Date() > license.expiresAt) {
          await prismaTx.licenseKey.update({ where: { id: license.id }, data: { status: LicenseStatus.EXPIRED } });
          await prismaTx.auditLog.create({ data: { action: 'LICENSE_EXPIRED', targetId: license.id } });
          throw new Error('License expired');
      }

      const deviceCount = await prismaTx.device.count({ where: { licenseKeyId: license.id, active: true } });
      let device = await prismaTx.device.findUnique({
        where: { deviceIdentifier_licenseKeyId: { deviceIdentifier, licenseKeyId: license.id } }
      });

      if (!device) {
        if (deviceCount >= license.maxDevices) throw new Error('Device limit reached');
        device = await prismaTx.device.create({
          data: { deviceIdentifier, licenseKeyId: license.id }
        });
        await prismaTx.auditLog.create({ data: { action: 'DEVICE_LINKED', targetId: license.id, details: device.id } });
      }
      
      await prismaTx.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

      return { licenseId: license.id, deviceId: device.id, status: LicenseStatus.ACTIVE, expiresAt: license.expiresAt };
    });
  }

  static async pauseIndividual(licenseId: string, adminId: string) {
    return await db.$transaction(async (prismaTx) => {
        const license = await prismaTx.licenseKey.findUnique({ where: { id: licenseId } });
        if (!license || !license.activatedAt || license.status === LicenseStatus.REVOKED || license.status === LicenseStatus.EXPIRED || license.status === LicenseStatus.INACTIVE || license.pausedIndividual) return;
        
        const now = new Date();
        const data: any = { pausedIndividual: true };
        
        if (!license.pausedGlobal) {
            data.remainingTimeAtPause = BigInt(license.expiresAt!.getTime() - now.getTime());
            data.lastPauseAt = now;
            data.status = LicenseStatus.PAUSED;
        }
        
        await prismaTx.licenseKey.update({ where: { id: licenseId }, data });
        await prismaTx.auditLog.create({ data: { action: 'LICENSE_PAUSED_INDIVIDUAL', targetId: licenseId, actorId: adminId } });
    });
  }

  static async resumeIndividual(licenseId: string, adminId: string) {
    return await db.$transaction(async (prismaTx) => {
        const license = await prismaTx.licenseKey.findUnique({ where: { id: licenseId } });
        if (!license || license.status !== LicenseStatus.PAUSED || !license.pausedIndividual) return;
        
        await prismaTx.licenseKey.update({ where: { id: licenseId }, data: { pausedIndividual: false } });
        
        const updated = await prismaTx.licenseKey.findUnique({ where: { id: licenseId } });
        if (updated && !updated.pausedIndividual && !updated.pausedGlobal) {
            const expiresAt = new Date(Date.now() + Number(updated.remainingTimeAtPause || 0));
            await prismaTx.licenseKey.update({
                where: { id: licenseId },
                data: { status: LicenseStatus.ACTIVE, expiresAt, remainingTimeAtPause: null, lastPauseAt: null }
            });
            await prismaTx.auditLog.create({ data: { action: 'LICENSE_RESUMED_INDIVIDUAL', targetId: licenseId, actorId: adminId } });
        }
    });
  }

  static async pauseAll(adminId: string) {
      const active = await db.licenseKey.findMany({ 
          where: { activatedAt: { not: null }, status: { in: [LicenseStatus.ACTIVE, LicenseStatus.PAUSED] } } 
      });
      const now = new Date();
      for (const lic of active) {
          if (lic.pausedGlobal) continue;
          await db.$transaction(async (prismaTx) => {
              const data: any = { pausedGlobal: true, status: LicenseStatus.PAUSED };
              if (!lic.pausedIndividual) {
                  data.remainingTimeAtPause = BigInt(lic.expiresAt!.getTime() - now.getTime());
                  data.lastPauseAt = now;
              }
              const updated = await prismaTx.licenseKey.update({ where: { id: lic.id }, data });
              await prismaTx.auditLog.create({ data: { action: 'LICENSE_PAUSED_GLOBAL', targetId: updated.id, actorId: adminId } });
          });
      }
  }

  static async resumeAll(adminId: string) {
      const paused = await db.licenseKey.findMany({ where: { status: LicenseStatus.PAUSED, pausedGlobal: true } });
      for (const lic of paused) {
          await db.$transaction(async (prismaTx) => {
            await prismaTx.licenseKey.update({ where: { id: lic.id }, data: { pausedGlobal: false } });
            const updated = await prismaTx.licenseKey.findUnique({ where: { id: lic.id } });
            if (updated && !updated.pausedIndividual && !updated.pausedGlobal) {
              const expiresAt = new Date(Date.now() + Number(updated.remainingTimeAtPause || 0));
              await prismaTx.licenseKey.update({ where: { id: lic.id }, data: { status: LicenseStatus.ACTIVE, expiresAt, remainingTimeAtPause: null, lastPauseAt: null } });
              await prismaTx.auditLog.create({ data: { action: 'LICENSE_RESUMED_GLOBAL', targetId: lic.id, actorId: adminId } });
            }
          });
      }
  }

  static async revoke(licenseId: string, adminId: string) {
      await db.licenseKey.update({ where: { id: licenseId }, data: { status: LicenseStatus.REVOKED, revokedAt: new Date() } });
      await db.auditLog.create({ data: { action: 'LICENSE_REVOKED', targetId: licenseId, actorId: adminId } });
  }

  static async disable(licenseId: string, adminId: string) {
      await db.licenseKey.update({ where: { id: licenseId }, data: { status: LicenseStatus.INACTIVE } });
      await db.auditLog.create({ data: { action: 'LICENSE_DISABLED', targetId: licenseId, actorId: adminId } });
  }

  static async enable(licenseId: string, adminId: string) {
    const lic = await db.licenseKey.findUnique({ where: { id: licenseId } });
    if (!lic) return;
    const newStatus = (lic.expiresAt && new Date() > lic.expiresAt) ? LicenseStatus.EXPIRED : LicenseStatus.ACTIVE;
    await db.licenseKey.update({ where: { id: licenseId }, data: { status: newStatus } });
    await db.auditLog.create({ data: { action: 'LICENSE_ENABLED', targetId: licenseId, actorId: adminId } });
  }
}
