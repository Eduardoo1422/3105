import { LicenseService } from '../services/license.service';
import { db } from '../db';
import { LicenseStatus } from '@prisma/client';

const computeFp = (k: string) => (LicenseService as any).computeFingerprint(k);

describe('LicenseService - Security Audit & Single Key Implementation', () => {
  beforeEach(async () => {
    await db.usernameToken.deleteMany();
    await db.device.deleteMany();
    await db.licenseKey.deleteMany();
    await db.auditLog.deleteMany();
  });

  test('A. criação diferida', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const fp = computeFp(key);
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier: fp } });
    expect(lic?.activatedAt).toBeNull();
    expect(lic?.expiresAt).toBeNull();
    expect(lic?.durationDays).toBe(30);
    expect(lic?.maskedKey).toMatch(/^ZROK-[A-Z2-9]{4}-\*{5}$/);
  });

  test('B. primeira ativação', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier: fp } });
    expect(lic?.activatedAt).not.toBeNull();
    expect(lic?.expiresAt).not.toBeNull();
  });

  test('C. idempotência da ativação', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const first = await db.licenseKey.findFirst({ where: { keyIdentifier: fp } });
    await LicenseService.validateLicense(key, 'd1');
    const second = await db.licenseKey.findFirst({ where: { keyIdentifier: fp } });
    expect(first?.activatedAt?.getTime()).toBe(second?.activatedAt?.getTime());
  });

  test('D. concorrência de ativação', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await Promise.all([
        LicenseService.validateLicense(key, 'd1'),
        LicenseService.validateLicense(key, 'd2')
    ].map(p => p.catch(() => {})));
    const fp = computeFp(key);
    const count = await db.device.count({ where: { licenseKeyId: (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!.id } });
    expect(count).toBe(1);
  });

  test('E. limite de dispositivos', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    await expect(LicenseService.validateLicense(key, 'd2')).rejects.toThrow('Device limit reached');
  });

  test('F. dispositivo duplicado', async () => {
    const { key } = await LicenseService.createLicense(30, 2);
    await LicenseService.validateLicense(key, 'd1');
    await LicenseService.validateLicense(key, 'd1');
    const count = await db.device.count({ where: { deviceIdentifier: 'd1' } });
    expect(count).toBe(1);
  });

  test('G. chave inválida', async () => {
    await expect(LicenseService.validateLicense('ZROK-INVALID-KEY', 'd1')).rejects.toThrow('Invalid license');
  });

  test('H. pausa individual', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    let l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.PAUSED);
    expect(l?.pausedIndividual).toBe(true);
    expect(l?.remainingTimeAtPause).not.toBeNull();
  });

  test('I. resume individual', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.resumeIndividual(lic.id, 'admin');
    let l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.ACTIVE);
    expect(l?.pausedIndividual).toBe(false);
  });

  test('J. pausa global', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    
    await LicenseService.pauseAll('admin');
    const fp = computeFp(key);
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier: fp } });
    expect(lic?.pausedGlobal).toBe(true);
    expect(lic?.remainingTimeAtPause).not.toBeNull();
  });

  test('K. resume global', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    
    await LicenseService.pauseAll('admin');
    await LicenseService.resumeAll('admin');
    const fp = computeFp(key);
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier: fp } });
    expect(lic?.pausedGlobal).toBe(false);
    expect(lic?.status).toBe(LicenseStatus.ACTIVE);
  });

  test('L. individual -> global', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;

    await LicenseService.pauseIndividual(lic.id, 'admin');
    const timeAtIndividualPause = (await db.licenseKey.findUnique({ where: { id: lic.id } }))!.remainingTimeAtPause;
    
    await LicenseService.pauseAll('admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.remainingTimeAtPause).toBe(timeAtIndividualPause);
  });

  test('M. global -> individual', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    
    await LicenseService.pauseAll('admin');
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.pausedIndividual).toBe(true);
    expect(l?.pausedGlobal).toBe(true);
  });

  test('N. resume global enquanto individual continua', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;

    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.pauseAll('admin');
    
    await LicenseService.resumeAll('admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.PAUSED);
    expect(l?.pausedIndividual).toBe(true);
  });

  test('O. resume individual enquanto global continua', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;

    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.pauseAll('admin');
    
    await LicenseService.resumeIndividual(lic.id, 'admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.PAUSED);
    expect(l?.pausedGlobal).toBe(true);
  });

  test('P. múltiplos ciclos', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    await LicenseService.validateLicense(key, 'd1');
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;
    
    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.resumeIndividual(lic.id, 'admin');
    await LicenseService.pauseIndividual(lic.id, 'admin');
    await LicenseService.resumeIndividual(lic.id, 'admin');
    
    let l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.ACTIVE);
  });

  test('Q. nunca ativada', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;
    await LicenseService.pauseIndividual(lic.id, 'admin');
    const l = await db.licenseKey.findUnique({ where: { id: lic.id } });
    expect(l?.status).toBe(LicenseStatus.ACTIVE);
  });

  test('R. expiração real', async () => {
    const { key } = await LicenseService.createLicense(0, 1);
    await LicenseService.validateLicense(key, 'd1');
    await expect(LicenseService.validateLicense(key, 'd2')).rejects.toThrow('License expired');
  });

  test('S. REVOKED', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;
    await db.licenseKey.update({ where: { id: lic.id }, data: { status: LicenseStatus.REVOKED } });
    await expect(LicenseService.pauseIndividual(lic.id, 'admin')).rejects.toThrow();
  });

  test('T. INACTIVE', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const fp = computeFp(key);
    const lic = (await db.licenseKey.findFirst({ where: { keyIdentifier: fp } }))!;
    await db.licenseKey.update({ where: { id: lic.id }, data: { status: LicenseStatus.INACTIVE } });
    await expect(LicenseService.pauseIndividual(lic.id, 'admin')).rejects.toThrow();
  });

  test('U. hash não exposto e username registration com token persistido no DB', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const result = await LicenseService.validateLicense(key, 'd1');
    expect(result).not.toHaveProperty('keyHash');
    expect(result.needsUsername).toBe(true);
    expect(result.usernameToken).toBeDefined();

    // Verify token is persisted in DB as hash (not plaintext)
    const tokenCount = await db.usernameToken.count();
    expect(tokenCount).toBe(1);
    const storedToken = await db.usernameToken.findFirst();
    expect(storedToken?.tokenHash).not.toBe(result.usernameToken);
    expect(storedToken?.used).toBe(false);

    // 1. Fail without token
    await expect(LicenseService.registerUsername(result.licenseId, 'testuser', 'd1')).rejects.toThrow('Missing username registration token');

    // 2. Fail with wrong token
    await expect(LicenseService.registerUsername(result.licenseId, 'testuser', 'd1', 'invalid-token')).rejects.toThrow();

    // 3. Success with valid token
    const reg = await LicenseService.registerUsername(result.licenseId, 'testuser', 'd1', result.usernameToken);
    expect(reg.success).toBe(true);

    // Verify token marked used in DB
    const updatedToken = await db.usernameToken.findFirst();
    expect(updatedToken?.used).toBe(true);

    // 4. Token single-use failure (reusing same token)
    await expect(LicenseService.registerUsername(result.licenseId, 'testuser2', 'd1', result.usernameToken)).rejects.toThrow();

    const result2 = await LicenseService.validateLicense(key, 'd1');
    expect(result2.username).toBe('testuser');
    expect(result2.needsUsername).toBe(false);
  });

  test('V. token vinculado a outro dispositivo', async () => {
    const { key } = await LicenseService.createLicense(30, 2);
    const result = await LicenseService.validateLicense(key, 'd1');
    expect(result.usernameToken).toBeDefined();

    await expect(
      LicenseService.registerUsername(result.licenseId, 'testuser', 'd2', result.usernameToken)
    ).rejects.toThrow();
  });

  test('W. token expirado', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const result = await LicenseService.validateLicense(key, 'd1');
    
    // Manually expire token in DB
    await db.usernameToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    await expect(
      LicenseService.registerUsername(result.licenseId, 'testuser', 'd1', result.usernameToken)
    ).rejects.toThrow('expired');
  });

  test('X. geração uniforme de keys (sem viés)', async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const k = (LicenseService as any).generateSecureKey();
      expect(k).toMatch(/^ZROK-[A-Z2-9]{4}-[A-Z2-9]{5}$/);
      keys.add(k);
    }
    expect(keys.size).toBe(100);
  });

  test('Y. impossibilidade de recuperar a key completa do banco', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const fp = computeFp(key);
    const lic = await db.licenseKey.findFirst({ where: { keyIdentifier: fp } });
    
    expect(lic).not.toBeNull();
    expect(lic?.keyIdentifier).not.toBe(key);
    expect(lic?.keyHash).not.toBe(key);
    expect(lic?.keyIdentifier.length).toBe(64);
  });

  test('Z. concorrência de cadastro de username (uso único atômico)', async () => {
    const { key } = await LicenseService.createLicense(30, 1);
    const result = await LicenseService.validateLicense(key, 'd1');
    expect(result.usernameToken).toBeDefined();

    const results = await Promise.allSettled([
      LicenseService.registerUsername(result.licenseId, 'userone', 'd1', result.usernameToken),
      LicenseService.registerUsername(result.licenseId, 'usertwo', 'd1', result.usernameToken)
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });
});
