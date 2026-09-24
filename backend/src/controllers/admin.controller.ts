import { Request, Response } from 'express';
import path from 'path';
import { LicenseService } from '../services/license.service';
import { CategoryService, FeatureService, ResourceService, StorageService } from '../services/data.service';
import { licenseCreateSchema, categoryCreateSchema, featureCreateSchema, resourceCreateSchema } from '../utils/validation';
import multer from 'multer';

// Extend Request type to include file
interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

// Parse MAX_UPLOAD_SIZE safely with fallback
const parseMaxUploadSize = (): number => {
    const raw = process.env.MAX_UPLOAD_SIZE;
    if (!raw) return 10 * 1024 * 1024; // 10MB default
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed <= 0) return 10 * 1024 * 1024; // fallback
    return parsed;
};

const upload = multer({ 
    limits: { fileSize: parseMaxUploadSize() }
}).single('file');

export const AdminLicenseController = {
  create: async (req: Request, res: Response) => {
    try {
      const validated = licenseCreateSchema.parse(req.body);
      const result = await LicenseService.createLicense(validated.days, validated.maxDevices, validated.notes, (req as any).user.userId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};

export const AdminCategoryController = {
  create: async (req: Request, res: Response) => {
    try {
      const validated = categoryCreateSchema.parse(req.body);
      const result = await CategoryService.create(validated);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
  list: async (req: Request, res: Response) => {
    const categories = await CategoryService.getAll();
    res.json(categories);
  }
};

export const AdminFeatureController = {
  create: async (req: Request, res: Response) => {
    try {
      const validated = featureCreateSchema.parse(req.body);
      const result = await FeatureService.create(validated);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};

export const AdminResourceController = {
    upload: (req: MulterRequest, res: Response) => {
        upload(req, res, async (err: any) => {
            if (err) return res.status(400).json({ error: err.message });
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            try {
                const validated = resourceCreateSchema.parse(req.body);
                
                if (!(await FeatureService.exists(validated.featureId))) {
                    return res.status(404).json({ error: 'Feature not found' });
                }

                const { storageKey, sha256 } = await StorageService.saveFile(req.file.buffer);
                
                // `targetFilename` is the destination filename inside the target
                // bundle and is distinct from the uploaded `filename` (the
                // original name as received). Default to the uploaded file's
                // basename when the client omits it; the controller always
                // forwards an explicit value to ResourceService.
                const targetFilename = validated.targetFilename ?? path.basename(req.file.originalname);
                
                try {
                    const resource = await ResourceService.create({
                        featureId: validated.featureId,
                        filename: req.file.originalname,
                        mimeType: req.file.mimetype,
                        fileSize: req.file.size,
                        sha256,
                        targetBundleId: validated.targetBundleId,
                        targetRelativePath: validated.targetRelativePath,
                        targetFilename,
                        storageKey
                    });
                    
                    res.json(resource);
                } catch (dbError: any) {
                    // Rollback: clean up file since DB failed
                    await StorageService.deleteFile(storageKey).catch(() => {});
                    throw dbError;
                }
            } catch (e: any) {
                res.status(400).json({ error: e.message });
            }
        });
    },
    list: async (req: Request, res: Response) => {
        try {
            const resources = await ResourceService.list();
            res.json({ resources });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },
    get: async (req: Request, res: Response) => {
        try {
            const resource = await ResourceService.getResourceWithVersions(req.params.id);
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' });
            }
            res.json(resource);
        } catch (e: any) {
            res.status(400).json({ error: e.message });
        }
    }
};

// Add download controller (protected by auth + admin middleware at route level)
export const ResourceDownloadController = {
    download: async (req: Request, res: Response) => {
        try {
            const resource = await ResourceService.getResourceWithLatestVersion(req.params.id);
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' });
            }

            const version = resource.versions?.[0];
            if (!version || !version.storageKey) {
                return res.status(404).json({ error: 'Resource has no downloadable version' });
            }

            const filePath = StorageService.getFilePath(version.storageKey);
            
            // Determine filename for download - use targetFilename, not client-provided original name
            const downloadName = version.targetFilename || 'download';

            res.download(filePath, downloadName, (err) => {
                if (err) {
                    console.error('Download error:', err);
                    res.status(500).json({ error: 'Download failed' });
                }
            });
        } catch (e: any) {
            if (e.message.includes('not found') || e.message.includes('Invalid')) {
                return res.status(404).json({ error: e.message });
            }
            res.status(400).json({ error: e.message });
        }
    }
};
