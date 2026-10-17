// Register the Prisma mock BEFORE any import that triggers `new PrismaClient()`.
jest.mock('@prisma/client', () => {
  const { mockPrismaClient } = require('./mocks');
  return {
    __esModule: true,
    PrismaClient: jest.fn(() => mockPrismaClient),
    LicenseStatus: {
      ACTIVE: 'ACTIVE',
      INACTIVE: 'INACTIVE',
      REVOKED: 'REVOKED',
      EXPIRED: 'EXPIRED',
    },
  };
});

import { ConfigService } from '../services/data.service';
import { appConfigSchema, deviceSyncStatusSchema } from '../utils/validation';
import { mockPrismaClient } from './mocks';

describe('AppConfig Validation and Service', () => {
  const validConfigPayload = {
    tabs: [
      {
        id: 'home',
        name: 'Início',
        icon: '🏠',
        order: 0,
        elements: [
          {
            id: 'elem-1',
            name: 'Anti-Ban',
            description: 'Shield',
            icon: '🛡️',
            type: 'toggle' as const,
            enabled: true,
            order: 0
          }
        ]
      }
    ],
    hero: {
      imageUrl: '',
      title: 'ZROK Enterprise',
      subtitle: 'Testing'
    },
    theme: {
      background: '#000000',
      cardBackground: '#111111',
      textColor: '#ffffff',
      secondaryText: '#888888',
      buttonColor: '#3b82f6',
      accentColor: '#10b981',
      borderColor: '#333333'
    }
  };

  it('should validate valid AppConfig payload with Zod schema', () => {
    const result = appConfigSchema.safeParse(validConfigPayload);
    expect(result.success).toBe(true);
  });

  it('should reject invalid AppConfig payload missing tabs', () => {
    const invalid = { ...validConfigPayload, tabs: [] };
    const result = appConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject incomplete configuration payload missing theme properties', () => {
    const incomplete = {
      ...validConfigPayload,
      theme: { background: '#000000' } // missing other theme fields
    };
    const result = appConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('should validate valid DeviceSyncStatus payload', () => {
    const validSync = {
      deviceIdentifier: 'device-12345',
      platform: 'iOS',
      appVersion: '1.0.1',
      syncedVersion: 2,
      syncStatus: 'synced' as const
    };
    const result = deviceSyncStatusSchema.safeParse(validSync);
    expect(result.success).toBe(true);
  });

  it('should reject invalid DeviceSyncStatus payload with invalid status', () => {
    const invalidSync = {
      deviceIdentifier: 'device-12345',
      syncedVersion: 1,
      syncStatus: 'unknown_status'
    };
    const result = deviceSyncStatusSchema.safeParse(invalidSync);
    expect(result.success).toBe(false);
  });

  it('should maintain draft vs published separation in ConfigService', async () => {
    let storedConfigJson = JSON.stringify({
      draft: validConfigPayload,
      published: validConfigPayload,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      devices: []
    });

    mockPrismaClient.appConfig.findUnique.mockImplementation(async () => ({
      id: 'default',
      config: storedConfigJson,
      updatedAt: new Date()
    }));

    mockPrismaClient.appConfig.upsert.mockImplementation(async ({ update, create }: any) => {
      storedConfigJson = update.config || create.config;
      return { id: 'default', config: storedConfigJson, updatedAt: new Date() };
    });

    // 1. Get config
    const initialConfig = await ConfigService.getConfig();
    expect(initialConfig.publishedVersion).toBe(1);

    // 2. Save draft with changes
    const modifiedDraft = {
      ...validConfigPayload,
      hero: { ...validConfigPayload.hero, title: 'Modified Draft Title' }
    };

    const savedDraftResult = await ConfigService.saveDraft(modifiedDraft);
    expect(savedDraftResult.draft.hero.title).toBe('Modified Draft Title');
    expect(savedDraftResult.published.hero.title).toBe('ZROK Enterprise');
    expect(savedDraftResult.publishedVersion).toBe(1);

    // 3. Publish draft
    const publishedResult = await ConfigService.publish();
    expect(publishedResult.published.hero.title).toBe('Modified Draft Title');
    expect(publishedResult.publishedVersion).toBe(2);
  });

  it('should record device sync status correctly', async () => {
    let storedConfigJson = JSON.stringify({
      draft: validConfigPayload,
      published: validConfigPayload,
      publishedVersion: 2,
      publishedAt: new Date().toISOString(),
      devices: []
    });

    mockPrismaClient.appConfig.findUnique.mockImplementation(async () => ({
      id: 'default',
      config: storedConfigJson,
      updatedAt: new Date()
    }));

    mockPrismaClient.appConfig.upsert.mockImplementation(async ({ update, create }: any) => {
      storedConfigJson = update.config || create.config;
      return { id: 'default', config: storedConfigJson, updatedAt: new Date() };
    });

    const updated = await ConfigService.recordDeviceSync({
      deviceIdentifier: 'real-ios-device-xyz',
      platform: 'iOS 18.2',
      appVersion: '1.0.1',
      syncedVersion: 2,
      syncStatus: 'synced'
    });

    expect(updated.devices.length).toBe(1);
    expect(updated.devices[0].deviceIdentifier).toBe('real-ios-device-xyz');
    expect(updated.devices[0].clientReportedStatus).toBe('synced');
    expect(updated.devices[0].matchesCurrentPublishedVersion).toBe(true);
    expect(updated.devices[0].lastSyncedVersion).toBe(2);
  });
});
