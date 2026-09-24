import { Router } from 'express';
import { AuthController, LicenseController, FeatureController } from '../controllers/api.controller';
import { AdminLicenseController, AdminCategoryController, AdminFeatureController, AdminResourceController, ResourceDownloadController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

// Auth
router.post('/auth/login', AuthController.login);

// Public / Protected
router.post('/license/validate', LicenseController.validate);
router.get('/bootstrap', FeatureController.bootstrap);

// Admin Routes
router.use(authMiddleware, adminMiddleware);

router.post('/admin/license', AdminLicenseController.create);
router.post('/admin/category', AdminCategoryController.create);
router.get('/admin/category', AdminCategoryController.list);
router.post('/admin/feature', AdminFeatureController.create);
router.post('/admin/resource', AdminResourceController.upload);
router.get('/admin/resource', AdminResourceController.list);
router.get('/admin/resource/:id', AdminResourceController.get);

// Download endpoint (protected by auth + admin via router.use above)
router.get('/admin/resource/:id/download', ResourceDownloadController.download);

export default router;
