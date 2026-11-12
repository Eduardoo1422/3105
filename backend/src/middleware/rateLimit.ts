import { Request, Response, NextFunction } from 'express';

const attempts = new Map<string, { count: number, resetAt: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of attempts.entries()) {
    if (now > data.resetAt) {
      attempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export const validateRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxAttempts = 20;

  let record = attempts.get(ip);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    attempts.set(ip, record);
    return next();
  }

  record.count++;
  if (record.count > maxAttempts) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }

  return next();
};
