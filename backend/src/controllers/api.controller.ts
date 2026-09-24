import { Request, Response } from 'express';
import { AuthService } from '../services/core.service';
import { LicenseService } from '../services/license.service';
import { FeatureService } from '../services/data.service';

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
