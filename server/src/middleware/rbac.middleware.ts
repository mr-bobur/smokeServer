import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types';

export const authorizeRoles = (...allowedRoles: Array<UserRole>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access Denied: Insufficient Privileges' });
    }
    next();
  };
};
