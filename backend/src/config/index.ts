import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.string().default('3000'),
  JWT_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_IDS: z.string().default(''),
  STORAGE_PATH: z.string().default('./uploads'),
  MAX_UPLOAD_SIZE: z.string().optional().refine(val => !val || (!isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0), {
    message: 'MAX_UPLOAD_SIZE must be a positive integer in bytes'
  })
});

const env = envSchema.parse(process.env);

export const config = {
  dbUrl: env.DATABASE_URL,
  port: parseInt(env.API_PORT, 10),
  jwtSecret: env.JWT_SECRET,
  telegramBotToken: env.TELEGRAM_BOT_TOKEN,
  telegramAdminIds: env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()).filter(Boolean),
  storagePath: env.STORAGE_PATH,
  maxUploadSize: env.MAX_UPLOAD_SIZE ? parseInt(env.MAX_UPLOAD_SIZE, 10) : 10 * 1024 * 1024 // 10MB default
};
