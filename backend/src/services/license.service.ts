import { db } from '../db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { LicenseStatus } from '@prisma/client';
import { config } from '../config';

export class LicenseService {
  private static computeFingerprint(key: string): string {
    const hmacSecret = config.hmacSecret;
    if (!hmacSecret) {
      throw new Error('ZROK_HMAC_SECRET configuration is missing or insecure');
    }
    return crypto.createHmac('sha256', hmacSecret).update(key).digest('hex');
  }

  private static generateSecureKey(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 31 chars
    const gen = (length: number) => {
      let result = '';
      while (result.length < length) {
        const buf = crypto.randomBytes(1);
        const val = buf[0];
        if (val < 248) { // 248 is largest multiple of 31 under 256 (31 * 8 = 248)
          result += chars[val % chars.length];
        }
      }
      return result;
    };
    return `ZROK-${gen(4)}-${gen(5)}`;
  }

  static async createLicense(durationDays: number, maxDevices: number, notes?: string, adminId?: string) {
    let key = this.generateSecureKey();
    let fingerprint = this.computeFingerprint(key);
    
    // Ensure uniqueness
    let exists = await db.licenseKey.findUnique({ where: { keyIdentifier: fingerprint } });
    while (exists) {
      key = this.generateSecureKey();
      fingerprint = this.computeFingerprint(key);
      exists = await db.licenseKey.findUnique({ where: { keyIdentifier: fingerprint } });
    }

    const keyHash = await bcrypt.hash(key, 10);
    const maskedKey = `ZROK-${key.split('-')[1]}-*****`;
    
    const license = await db.licenseKey.create({
      data: {
        keyIdentifier: fingerprint,
        keyHash,
        maskedKey,
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
    return { keyIdentifier: fingerprint, maskedKey, rawSecret: key, key };
  }

  static async validateLicense(key: string, deviceIdentifier: string, ip?: string) {
    return await db.$transaction(async (prismaTx) => {
      const fingerprint = this.computeFingerprint(key);
      let license = await prismaTx.licenseKey.findUnique({ where: { keyIdentifier: fingerprint } });
      
      // Fallback for legacy keys if any exist in test/legacy environments
      if (!license) {
        license = await prismaTx.licenseKey.findUnique({ where: { keyIdentifier: key } });
      }

      if (!license) throw new Error('Invalid license');
      if (license.status === LicenseStatus.REVOKED) throw new Error('License revoked');
      if (license.status === LicenseStatus.INACTIVE) throw new Error('License inactive');
      if (license.status === LicenseStatus.PAUSED) throw new Error('License paused');
      if (license.status === LicenseStatus.EXPIRED) throw new Error('License expired');
      
      if (!(await bcrypt.compare(key, license.keyHash))) throw new Error('Invalid license');

      // Deferred Activation
      if (!license.activatedAt) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (license.durationDays * 24 * 60 * 60 * 1000));
        
        await prismaTx.licenseKey.update({
          where: { id: license.id },
          data: { activatedAt: now, expiresAt }
        });
        license.activatedAt = now;
        license.expiresAt = expiresAt;
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
          data: { deviceIdentifier, licenseKeyId: license.id, lastIp: ip }
        });
        await prismaTx.auditLog.create({ data: { action: 'DEVICE_LINKED', targetId: license.id, details: device.id } });
      } else {
        await prismaTx.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date(), lastIp: ip } });
      }

      let usernameToken: string | undefined = undefined;
      if (!license.username) {
        usernameToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(usernameToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
        await prismaTx.usernameToken.create({
          data: {
            tokenHash,
            licenseKeyId: license.id,
            deviceIdentifier,
            expiresAt
          }
        });
      }
      
      return { 
        licenseId: license.id, 
        status: LicenseStatus.ACTIVE, 
        expiresAt: license.expiresAt,
        username: license.username,
        needsUsername: !license.username,
        usernameToken
      };
    });
  }

  static async registerUsername(licenseId: string, username: string, deviceIdentifier: string, usernameToken?: string) {
    if (!username || username.length < 3 || username.length > 20) throw new Error('Invalid username length');
    if (!usernameToken) throw new Error('Missing username registration token');

    const tokenHash = crypto.createHash('sha256').update(usernameToken).digest('hex');

    return await db.$transaction(async (prismaTx) => {
      const tokenRecord = await prismaTx.usernameToken.findUnique({ where: { tokenHash } });
      if (!tokenRecord) throw new Error('Invalid or expired username registration token');
      if (tokenRecord.used) throw new Error('Username registration token already used');
      if (tokenRecord.expiresAt < new Date()) throw new Error('Username registration token expired');
      if (tokenRecord.licenseKeyId !== licenseId || tokenRecord.deviceIdentifier !== deviceIdentifier) {
        throw new Error('Token does not match license or device');
      }

      // Atomically invalidate token (single-use)
      const updateRes = await prismaTx.usernameToken.updateMany({
        where: { id: tokenRecord.id, used: false },
        data: { used: true }
      });
      if (updateRes.count === 0) throw new Error('Invalid or expired username registration token');

      const license = await prismaTx.licenseKey.findUnique({ 
        where: { id: licenseId },
        include: { devices: true }
      });
      
      if (!license) throw new Error('License not found');
      if (license.username) throw new Error('Username already registered');
      
      const isDeviceLinked = license.devices.some(d => d.deviceIdentifier === deviceIdentifier && d.active);
      if (!isDeviceLinked) throw new Error('Device not authorized for this license');

      const existing = await prismaTx.licenseKey.findUnique({ where: { username } });
      if (existing) throw new Error('Username already taken');

      await prismaTx.licenseKey.update({
        where: { id: licenseId },
        data: { username }
      });

      await prismaTx.auditLog.create({ 
        data: { action: 'USERNAME_REGISTERED', targetId: licenseId, details: username } 
      });

      return { success: true, username };
    });
  }

  static async pauseIndividual(licenseId: string, adminId: string) {
    return await db.$transaction(async (prismaTx) => {
        const license = await prismaTx.licenseKey.findUnique({ where: { id: licenseId } });
        if (!license) throw new Error('License not found');
        if (license.status === LicenseStatus.REVOKED) throw new Error('License is revoked');
        if (license.status === LicenseStatus.EXPIRED) throw new Error('License is expired');
        if (license.status === LicenseStatus.INACTIVE) throw new Error('License is inactive');
        if (!license.activatedAt || license.pausedIndividual) return;
        
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
