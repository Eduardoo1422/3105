import { db, PrismaClient } from '../db/index';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class FeatureService {
  static async exists(id: string) {
    const feature = await db.feature.findUnique({ where: { id } });
    return !!feature;
  }

  static async getAll() {
    return await db.feature.findMany({
      where: { enabled: true, category: { enabled: true } },
      include: {
        resources: {
          include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } }
        }
      }
    });
  }

  static async create(data: { name: string, description: string, categoryId: string, iconName: string, enabled: boolean }) {
    return await db.feature.create({ data });
  }
}

export class CategoryService {
  static async getAll() {
    return await db.category.findMany();
  }

  static async create(data: { name: string, slug: string, enabled: boolean }) {
    return await db.category.create({ data });
  }
}

export class StorageService {
    /**
     * Validates that a storage key is a safe UUID-like value and resolves to a path
     * within the configured storage directory, preventing path traversal.
     */
    static validateStorageKey(storageKey: string): void {
        if (!storageKey || typeof storageKey !== 'string') {
            throw new Error('Invalid storage key: missing or non-string');
        }
        // Reject any path separators or parent references
        if (/[\/\\]/.test(storageKey) || storageKey === '..' || storageKey === '.') {
            throw new Error('Invalid storage key: contains path separators');
        }
        if (!/^[a-f0-9\-]+$/.test(storageKey.toLowerCase())) {
            throw new Error('Invalid storage key: must be alphanumeric (UUID format)');
        }
    }

    /**
     * Ensures the storage directory exists safely.
     */
    static ensureStoragePath(): void {
        try {
            fs.mkdirSync(config.storagePath, { recursive: true });
        } catch (e: any) {
            if (e.code !== 'EEXIST') throw e;
        }
    }

    static async saveFile(buffer: Buffer): Promise<{ storageKey: string; sha256: string }> {
        this.ensureStoragePath();

        const storageKey = crypto.randomUUID();
        const filePath = path.join(config.storagePath, storageKey);

        // Prevent path traversal - final check
        const resolvedPath = path.resolve(filePath);
        const resolvedStorage = path.resolve(config.storagePath);
        if (!resolvedPath.startsWith(resolvedStorage + path.sep) && resolvedPath !== resolvedStorage) {
            throw new Error('Invalid file path: path traversal detected');
        }

        // Write file atomically: write to temp then rename
        const tmpPath = `${filePath}.tmp`;
        fs.writeFileSync(tmpPath, buffer);
        fs.renameSync(tmpPath, filePath);

        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

        return { storageKey, sha256 };
    }

    static getFilePath(storageKey: string): string {
        this.validateStorageKey(storageKey);

        const filePath = path.join(config.storagePath, storageKey);
        const resolvedPath = path.resolve(filePath);
        const resolvedStorage = path.resolve(config.storagePath);

        // Prevent path traversal
        if (!resolvedPath.startsWith(resolvedStorage + path.sep) && resolvedPath !== resolvedStorage) {
            throw new Error('Invalid file path: path traversal detected');
        }

        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }

        return filePath;
    }

    static async deleteFile(storageKey: string): Promise<void> {
        this.validateStorageKey(storageKey);

        const filePath = path.join(config.storagePath, storageKey);
        const resolvedPath = path.resolve(filePath);
        const resolvedStorage = path.resolve(config.storagePath);

        if (!resolvedPath.startsWith(resolvedStorage + path.sep) && resolvedPath !== resolvedStorage) {
            throw new Error('Invalid file path: path traversal detected');
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    static async getFileBuffer(storageKey: string): Promise<Buffer> {
        const filePath = this.getFilePath(storageKey);
        return fs.readFileSync(filePath);
    }
}

export class ResourceService {
    static async create(data: {
        featureId: string;
        filename: string;
        mimeType: string;
        fileSize: number;
        sha256: string;
        targetBundleId: string;
        targetRelativePath: string;
        targetFilename: string;
        storageKey: string;
    }, tx?: PrismaClient) {
        const client = tx ?? db;
        return await client.$transaction(async (prismaTx) => {
            const resource = await prismaTx.resource.create({
                data: {
                    featureId: data.featureId,
                    filename: data.filename,
                    mimeType: data.mimeType,
                    fileSize: data.fileSize,
                    sha256: data.sha256,
                    targetBundleId: data.targetBundleId,
                    targetRelativePath: data.targetRelativePath,
                    targetFilename: data.targetFilename
                }
            });

            await prismaTx.resourceVersion.create({
                data: {
                    resourceId: resource.id,
                    version: '1.0.0',
                    filename: data.filename,
                    storageKey: data.storageKey,
                    fileSize: data.fileSize,
                    sha256: data.sha256,
                    targetBundleId: data.targetBundleId,
                    targetRelativePath: data.targetRelativePath,
                    targetFilename: data.targetFilename
                }
            });

            return resource;
        });
    }

    static async getById(id: string) {
        return await db.resource.findUnique({
            where: { id },
            include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } }
        });
    }

    static async getResourceWithLatestVersion(id: string) {
        return await db.resource.findUnique({
            where: { id },
            include: {
                feature: { select: { id: true, name: true } },
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        version: true,
                        storageKey: true,
                        sha256: true,
                        fileSize: true,
                        targetBundleId: true,
                        targetRelativePath: true,
                        targetFilename: true,
                        releaseNotes: true
                    }
                }
            }
        });
    }

    /**
     * Retrieves full resource with ALL versions for history.
     */
    static async getResourceWithVersions(id: string) {
        return await db.resource.findUnique({
            where: { id },
            include: {
                feature: { select: { id: true, name: true } },
                versions: { orderBy: { createdAt: 'desc' } }
            }
        });
    }

    /**
     * List all resources with their latest version.
     */
    static async list() {
        return await db.resource.findMany({
            include: {
                feature: { select: { id: true, name: true } },
                versions: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}

const DEFAULT_APP_CONFIG = {
  tabs: [
    {
      id: 'home',
      name: 'Início',
      icon: '🏠',
      order: 0,
      elements: [
        { id: 'elem-1', name: 'Anti-Ban Protection', description: 'Advanced kernel telemetry shield active for Free Fire', icon: '🛡️', type: 'toggle', enabled: true, order: 0 },
        { id: 'elem-2', name: 'Instant Patch Loader', description: 'Inject memory patches and bundles on startup', icon: '⚡', type: 'action', enabled: true, order: 1 }
      ]
    },
    {
      id: 'cleaner',
      name: 'Limpeza',
      icon: '🧹',
      order: 1,
      elements: [
        { id: 'elem-3', name: 'Cache Cleaner', description: 'Purge temporary game assets and logs', icon: '🗑️', type: 'action', enabled: true, order: 0 }
      ]
    }
  ],
  hero: { imageUrl: '', title: 'ZROK Enterprise v2.0', subtitle: 'Free Fire Advanced Customization & Patch Center' },
  theme: { background: '#0b0f19', cardBackground: '#131c31', textColor: '#f8fafc', secondaryText: '#94a3b8', buttonColor: '#3b82f6', accentColor: '#10b981', borderColor: '#1e293b' }
};

export class ConfigService {
  static async getConfig(): Promise<any> {
    const record = await db.appConfig.findUnique({ where: { id: 'default' } });
    if (!record || !record.config) {
      const defaultStructure = {
        draft: DEFAULT_APP_CONFIG,
        published: DEFAULT_APP_CONFIG,
        publishedVersion: 1,
        publishedAt: new Date().toISOString(),
        devices: []
      };
      return defaultStructure;
    }
    try {
      const parsed = JSON.parse(record.config);
      if (!parsed.draft) {
        return {
          draft: parsed,
          published: parsed,
          publishedVersion: 1,
          publishedAt: new Date().toISOString(),
          devices: []
        };
      }
      return parsed;
    } catch {
      return {
        draft: DEFAULT_APP_CONFIG,
        published: DEFAULT_APP_CONFIG,
        publishedVersion: 1,
        publishedAt: new Date().toISOString(),
        devices: []
      };
    }
  }

  static async saveDraft(draftData: any): Promise<any> {
    const current = await this.getConfig();
    current.draft = draftData;
    const configString = JSON.stringify(current);
    const record = await db.appConfig.upsert({
      where: { id: 'default' },
      update: { config: configString },
      create: { id: 'default', config: configString }
    });
    return JSON.parse(record.config);
  }

  static async publish(): Promise<any> {
    const current = await this.getConfig();
    current.published = JSON.parse(JSON.stringify(current.draft));
    current.publishedVersion = (current.publishedVersion || 0) + 1;
    current.publishedAt = new Date().toISOString();

    const configString = JSON.stringify(current);
    const record = await db.appConfig.upsert({
      where: { id: 'default' },
      update: { config: configString },
      create: { id: 'default', config: configString }
    });
    return JSON.parse(record.config);
  }

  static async recordDeviceSync(deviceData: { deviceIdentifier: string; platform?: string; appVersion?: string; syncedVersion: number; syncStatus: string }): Promise<any> {
    const current = await this.getConfig();
    if (!current.devices) {
      current.devices = [];
    }
    const idx = current.devices.findIndex((d: any) => d.deviceIdentifier === deviceData.deviceIdentifier);
    const matchesCurrentPublished = deviceData.syncedVersion === (current.publishedVersion || 1);
    const deviceEntry = {
      deviceIdentifier: deviceData.deviceIdentifier,
      platform: deviceData.platform || 'iOS',
      appVersion: deviceData.appVersion || '1.1.1',
      lastSyncedVersion: deviceData.syncedVersion,
      clientReportedStatus: deviceData.syncStatus,
      matchesCurrentPublishedVersion: matchesCurrentPublished,
      lastSyncAt: new Date().toISOString()
    };
    if (idx >= 0) {
      current.devices[idx] = deviceEntry;
    } else {
      current.devices.push(deviceEntry);
    }

    const configString = JSON.stringify(current);
    await db.appConfig.upsert({
      where: { id: 'default' },
      update: { config: configString },
      create: { id: 'default', config: configString }
    });
    return current;
  }
}
