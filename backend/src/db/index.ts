import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();

// Re-export PrismaClient type for services that need it
export type { PrismaClient };
