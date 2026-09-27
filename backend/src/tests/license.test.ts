import { LicenseService } from '../services/license.service';
import { db } from '../db';
import { LicenseStatus } from '@prisma/client';

describe('LicenseService - Final Robust Implementation', () => {
  beforeEach(async () => {
    await db.device.deleteMany();
    await db.licenseKey.deleteMany();
    await db.auditLog.deleteMany();
  });

  test('A. criação diferida', async () => {
    const { keyIdentifier } = await LicenseService.createLicense(30, 1);
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier } });
    expect(lic?.activatedAt).toBeNull();
    expect(lic?.expiresAt).toBeNull();
    expect(lic?.durationDays).toBe(30);
  });

  test('B. primeira ativação', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier } });
    expect(lic?.activatedAt).not.toBeNull();
    expect(lic?.expiresAt).not.toBeNull();
  });

  test('C. idempotência da ativação', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const first = await db.licenseKey.findFirst({ where: { keyIdentifier } });
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const second = await db.licenseKey.findFirst({ where: { keyIdentifier } });
    expect(first?.activatedAt?.getTime()).toBe(second?.activatedAt?.getTime());
  });

  test('D. concorrência de ativação', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await Promise.all([
        LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1'),
        LicenseService.validateLicense(keyIdentifier, rawSecret, 'd2')
    ].map(p => p.catch(() => {})));
    const count = await db.device.count({ where: { licenseKeyId: (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!.id } });
    expect(count).toBe(1);
  });

  test('E. limite de dispositivos', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    await expect(LicenseService.validateLicense(keyIdentifier, rawSecret, 'd2')).rejects.toThrow('Device limit reached');
  });

  test('F. dispositivo duplicado', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 2);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const count = await db.device.count({ where: { deviceIdentifier: 'd1' } });
    expect(count).toBe(1);
  });

  test('G. segredo inválido', async () => {
    const { keyIdentifier } = await LicenseService.createLicense(30, 1);
    await expect(LicenseService.validateLicense(keyIdentifier, 'wrong', 'd1')).rejects.toThrow('Invalid license');
  });

  test('H. pausa individual', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    let l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.PAUSED);
    expect(l?.pausedIndividual).toBe(true);
    expect(l?.remainingTimeAtPause).not.toBeNull();
  });

  test('I. resume individual', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.resumeIndividual(lic.id, 'admin');
    let l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.ACTIVE);
    expect(l?.pausedIndividual).toBe(false);
  });

  test('J. pausa global', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    
    await LicenseService.pauseAll('admin');
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier } });
    expect(lic?.pausedGlobal).toBe(true);
    expect(lic?.remainingTimeAtPause).not.toBeNull();
  });

  test('K. resume global', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    
    await LicenseService.pauseAll('admin');
    await LicenseService.resumeAll('admin');
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier } });
    expect(lic?.pausedGlobal).toBe(false);
    expect(lic?.status).toBe(LicenseStatus.ACTIVE);
  });

  test('L. individual -> global', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;

    await LicenseService.pauseIndividual(lic.id, 'admin');
    const timeAtIndividualPause = (await db.licenseKey.findUnique({ where: { id: lic.id } }))!.remainingTimeAtPause;
    
    await LicenseService.pauseAll('admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.remainingTimeAtPause).toBe(timeAtIndividualPause); // Preserve
  });

  test('M. global -> individual', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    
    await LicenseService.pauseAll('admin');
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.pausedIndividual).toBe(true);
    expect(l?.pausedGlobal).toBe(true);
  });

  test('N. resume global enquanto individual continua', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;

    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.pauseAll('admin');
    
    await LicenseService.resumeAll('admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.PAUSED); // Should still be PAUSED by individual
    expect(l?.pausedIndividual).toBe(true);
  });

  test('O. resume individual enquanto global continua', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;

    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.pauseAll('admin');
    
    await LicenseService.resumeIndividual(lic.id, 'admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.PAUSED); // Should still be PAUSED by global
    expect(l?.pausedGlobal).toBe(true);
  });

  test('P. múltiplos ciclos', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.resumeIndividual(lic.id, 'admin');
    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.resumeIndividual(lic.id, 'admin');
    
    let l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.ACTIVE);
  });

  test('Q. nunca ativada', async () => {
    const { keyIdentifier } = await LicenseService.createLicense(30, 1);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;
    await LicenseService.pauseIndividual(lic.id, 'admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.ACTIVE); // Should not pause
  });

  test('R. expiração real', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(0, 1);
    await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    await expect(LicenseService.validateLicense(keyIdentifier, rawSecret, 'd2')).rejects.toThrow('License expired');
  });

  test('S. REVOKED', async () => {
    const { keyIdentifier } = await LicenseService.createLicense(30, 1);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;
    await db.licenseKey.update({ where: { id: lic.id }, data: { status: LicenseStatus.REVOKED } });
    await expect(LicenseService.pauseIndividual(lic.id, 'admin')).rejects.toThrow();
  });

  test('T. INACTIVE', async () => {
    const { keyIdentifier } = await LicenseService.createLicense(30, 1);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier } }))!;
    await db.licenseKey.update({ where: { id: lic.id }, data: { status: LicenseStatus.INACTIVE } });
    await expect(LicenseService.pauseIndividual(lic.id, 'admin')).rejects.toThrow();
  });

  test('U. segredo/hash não expostos', async () => {
    const { keyIdentifier, rawSecret } = await LicenseService.createLicense(30, 1);
    const result = await LicenseService.validateLicense(keyIdentifier, rawSecret, 'd1');
    // Result should not have rawSecret or keyHash
    expect(result).not.toHaveProperty('rawSecret');
    expect(result).not.toHaveProperty('keyHash');
  });
});
