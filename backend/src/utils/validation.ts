import { z } from 'zod';

export const licenseCreateSchema = z.object({
  days: z.number().int().positive(),
  maxDevices: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  enabled: z.boolean().default(true),
});

export const resourceCreateSchema = z.object({
  featureId: z.string().uuid(),
  targetBundleId: z.string().min(1),
  targetRelativePath: z.string().min(1).refine(val => !val.includes('..') && !val.startsWith('/'), {
    message: 'Invalid targetRelativePath: Path traversal or absolute paths are not allowed'
  }),
  // Destination filename inside the target bundle. This is intentionally a
  // separate, validated field from the uploaded `filename` (the original name
  // of the file as received). It defaults to the uploaded file's basename when
  // omitted by the caller, but is always validated to be a bare filename with
  // no path separators (prevents path traversal / confusing the two concepts).
  targetFilename: z.string().min(1).refine(val => !val.includes('/') && !val.includes('\\') && val !== '..' && val !== '.', {
    message: 'Invalid targetFilename: must be a bare filename (no path separators)'
  }).optional(),
});

export const featureCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().uuid(),
  iconName: z.string().min(1),
  enabled: z.boolean().default(true),
});

export const appConfigSchema = z.object({
  tabs: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().min(1),
    order: z.number().int().nonnegative(),
    elements: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().min(1),
      type: z.enum(['toggle', 'action', 'info', 'card', 'separator']),
      enabled: z.boolean(),
      order: z.number().int().nonnegative()
    }))
  })).min(1),
  hero: z.object({
    imageUrl: z.string().optional(),
    title: z.string().min(1),
    subtitle: z.string().optional()
  }),
  theme: z.object({
    background: z.string().min(1),
    cardBackground: z.string().min(1),
    textColor: z.string().min(1),
    secondaryText: z.string().min(1),
    buttonColor: z.string().min(1),
    accentColor: z.string().min(1),
    borderColor: z.string().min(1)
  })
});

export const deviceSyncStatusSchema = z.object({
  deviceIdentifier: z.string().min(1).max(128),
  platform: z.string().optional(),
  appVersion: z.string().optional(),
  syncedVersion: z.number().int().positive(),
  syncStatus: z.enum(['synced', 'pending', 'offline', 'error'])
});
