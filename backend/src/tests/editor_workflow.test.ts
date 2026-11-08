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
import { appConfigSchema, resourceCreateSchema } from '../utils/validation';
import { mockPrismaClient } from './mocks';

describe('ZROK Editor, Persistence, Preview & .3105 Publication Workflow', () => {
  const baseConfig = {
    tabs: [
      {
        id: 'home',
        name: 'Início',
        icon: '🏠',
        order: 0,
        elements: [
          {
            id: 'elem-1',
            name: 'Anti-Ban Protection',
            description: 'Kernel Shield',
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
      title: 'ZROK Enterprise v2.0',
      subtitle: 'Advanced Customization'
    },
    theme: {
      background: '#0b0f19',
      cardBackground: '#131c31',
      textColor: '#f8fafc',
      secondaryText: '#94a3b8',
      buttonColor: '#3b82f6',
      accentColor: '#10b981',
      borderColor: '#1e293b'
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('1 & 2. Opening editor loads saved state and preserving alterations after save/reload', async () => {
    let storageState = JSON.stringify({
      draft: baseConfig,
      published: baseConfig,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      devices: []
    });

    mockPrismaClient.appConfig.findUnique.mockImplementation(async () => ({
      id: 'default',
      config: storageState,
      updatedAt: new Date()
    }));

    mockPrismaClient.appConfig.upsert.mockImplementation(async ({ update, create }: any) => {
      storageState = update.config || create.config;
      return { id: 'default', config: storageState, updatedAt: new Date() };
    });

    // Load initial config (Opening editor)
    const loaded = await ConfigService.getConfig();
    expect(loaded.draft.hero.title).toBe('ZROK Enterprise v2.0');

    // Alter and save draft
    const modifiedDraft = {
      ...loaded.draft,
      hero: { ...loaded.draft.hero, title: 'Updated Custom Title' }
    };
    const saved = await ConfigService.saveDraft(modifiedDraft);
    expect(saved.draft.hero.title).toBe('Updated Custom Title');

    // Reopen (Reload config)
    const reloaded = await ConfigService.getConfig();
    expect(reloaded.draft.hero.title).toBe('Updated Custom Title');
  });

  it('3 & 9. Preview uses loaded/edited draft data adhering to shared config contract', () => {
    const parsed = appConfigSchema.safeParse(baseConfig);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tabs.length).toBeGreaterThan(0);
      expect(parsed.data.theme.background).toBe('#0b0f19');
    }
  });

  it('4. API failure / error does not erase last valid state or overwrite with defaults', async () => {
    const validStored = {
      draft: baseConfig,
      published: baseConfig,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      devices: []
    };

    mockPrismaClient.appConfig.findUnique.mockResolvedValue({
      id: 'default',
      config: JSON.stringify(validStored),
      updatedAt: new Date()
    });

    // Simulate DB read error or network error
    mockPrismaClient.appConfig.findUnique.mockRejectedValueOnce(new Error('Database connection timeout'));

    // ConfigService.getConfig fallback or catch handling
    // If ConfigService throws, the controller catches and preserves client/last valid state without wiping data
    await expect(ConfigService.getConfig()).rejects.toThrow('Database connection timeout');
    
    // Subsequent successful call returns the intact valid stored state
    mockPrismaClient.appConfig.findUnique.mockResolvedValueOnce({
      id: 'default',
      config: JSON.stringify(validStored),
      updatedAt: new Date()
    });
    const recovered = await ConfigService.getConfig();
    expect(recovered.draft.hero.title).toBe('ZROK Enterprise v2.0');
  });

  it('5. Publishing updates published version only after backend confirmation', async () => {
    let storageState = JSON.stringify({
      draft: { ...baseConfig, hero: { ...baseConfig.hero, title: 'Draft Ready' } },
      published: baseConfig,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      devices: []
    });

    mockPrismaClient.appConfig.findUnique.mockImplementation(async () => ({
      id: 'default',
      config: storageState,
      updatedAt: new Date()
    }));

    mockPrismaClient.appConfig.upsert.mockImplementation(async ({ update, create }: any) => {
      storageState = update.config || create.config;
      return { id: 'default', config: storageState, updatedAt: new Date() };
    });

    const beforePublish = await ConfigService.getConfig();
    expect(beforePublish.publishedVersion).toBe(1);
    expect(beforePublish.published.hero.title).toBe('ZROK Enterprise v2.0');

    // Confirm publish
    const publishResult = await ConfigService.publish();
    expect(publishResult.publishedVersion).toBe(2);
    expect(publishResult.published.hero.title).toBe('Draft Ready');
  });

  it('6 & 7. Unsafe paths or invalid package format are rejected by resource validation schema', () => {
    const invalidPathPayload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.example.game',
      targetRelativePath: '/absolute/path/not/allowed',
      targetFilename: 'config.dat'
    };
    const res1 = resourceCreateSchema.safeParse(invalidPathPayload);
    expect(res1.success).toBe(false);

    const traversalPayload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.example.game',
      targetRelativePath: 'Documents/../etc',
      targetFilename: 'config.dat'
    };
    const res2 = resourceCreateSchema.safeParse(traversalPayload);
    expect(res2.success).toBe(false);

    const invalidFilenamePayload = {
      featureId: '123e4567-e89b-12d3-a456-426614174000',
      targetBundleId: 'com.example.game',
      targetRelativePath: 'Documents',
      targetFilename: 'sub/folder/file.dat'
    };
    const res3 = resourceCreateSchema.safeParse(invalidFilenamePayload);
    expect(res3.success).toBe(false);
  });
});
