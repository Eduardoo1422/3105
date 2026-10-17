import { Request, Response } from 'express';
import { AuthService } from '../services/core.service';
import { LicenseService } from '../services/license.service';
import { FeatureService, StorageService } from '../services/data.service';
import { db } from '../db';
import fs from 'fs';
import crypto from 'crypto';

export const AuthController = {
  login: async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const result = await AuthService.login(username, password);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  }
};

export const LicenseController = {
  validate: async (req: Request, res: Response) => {
    try {
      const { keyIdentifier, rawSecret, deviceIdentifier } = req.body;
      const result = await LicenseService.validateLicense(keyIdentifier, rawSecret, deviceIdentifier);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  }
};

export const FeatureController = {
  bootstrap: async (req: Request, res: Response) => {
    try {
      const features = await FeatureService.getAll();
      res.json({ features });
    } catch (e: any) {
      res.status(500).json({ error: 'Internal error' });
    }
  }
};

export const ResourceClientController = {
  download: async (req: Request, res: Response) => {
    try {
      const { keyIdentifier, rawSecret, deviceIdentifier } = req.body;
      if (!keyIdentifier || !rawSecret || !deviceIdentifier) {
        return res.status(401).json({ error: 'License validation credentials required' });
      }

      // Validate active license and device association
      await LicenseService.validateLicense(keyIdentifier, rawSecret, deviceIdentifier);

      const resource = await db.resource.findUnique({
        where: { id: req.params.id },
        include: {
          feature: { include: { category: true } },
          versions: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      });

      if (!resource || !resource.feature.enabled || !resource.feature.category.enabled) {
        return res.status(404).json({ error: 'Resource not found or feature disabled' });
      }

      const version = resource.versions?.[0];
      if (!version || !version.storageKey) {
        return res.status(404).json({ error: 'Resource version not found' });
      }

      const filePath = StorageService.getFilePath(version.storageKey);
      
      // Verify storage file integrity (SHA256)
      const fileBuffer = fs.readFileSync(filePath);
      const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      if (computedHash !== version.sha256) {
        return res.status(500).json({ error: 'Stored resource integrity validation failed' });
      }

      const downloadName = version.targetFilename || resource.filename;
      res.download(filePath, downloadName);
    } catch (e: any) {
      res.status(401).json({ error: e.message || 'Unauthorized download' });
    }
  }
};
