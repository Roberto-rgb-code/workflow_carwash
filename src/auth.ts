import { Request, Response, NextFunction } from 'express';

export function requireN8nApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.N8N_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: 'N8N_API_KEY not configured' });
  }

  const header = req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!header || header !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}
