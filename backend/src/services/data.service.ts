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
