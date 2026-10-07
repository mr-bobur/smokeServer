import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtUserPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'smart-building-enterprise-jwt-secret-2026';

export const signJwtToken = (payload: JwtUserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
      req.user = decoded;
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid or expired JWT token' });
      return;
    }
  }

  // Fallback for local development convenience when x-demo-role header is supplied
  const demoRole = req.headers['x-demo-role'] as string | undefined;
  if (demoRole && ['super_admin', 'tenant', 'user'].includes(demoRole)) {
    req.user = {
      id: demoRole === 'super_admin' ? 1 : demoRole === 'tenant' ? 2 : 3,
      email:
        demoRole === 'super_admin'
          ? 'admin@smartbuilding.uz'
          : demoRole === 'tenant'
            ? 'shirkat@smartbuilding.uz'
            : 'aziza.apt42@gmail.com',
      role: demoRole as JwtUserPayload['role'],
      name:
        demoRole === 'super_admin'
          ? 'Sardor Alimov (Chief Engineer)'
          : demoRole === 'tenant'
            ? 'Dilshod Karimov (Shirkat Manager)'
            : 'Aziza Rustamova (Apt 42 Owner)'
    };
    next();
    return;
  }

  res.status(401).json({ error: 'Authentication required: Missing Bearer token' });
};
