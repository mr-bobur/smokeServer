import { Request, Response } from 'express';
import { dbStore } from '../config/database';
import { signJwtToken } from '../middleware/auth.middleware';
import { AuthenticatedRequest, UserRecord, UserRole } from '../types';

export const googleAuthCallback = (req: Request, res: Response): void => {
  const user = req.user as unknown as UserRecord | undefined;
  if (!user) {
    res.status(401).json({ error: 'Google OAuth authentication failed' });
    return;
  }

  const token = signJwtToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  });

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  res.redirect(`${clientUrl}/login?token=${token}&role=${user.role}`);
};

export const ssoDemoLogin = (req: Request, res: Response): void => {
  const { role, email } = req.body as { role?: UserRole; email?: string };

  let user: UserRecord | undefined;
  if (email) {
    user = dbStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  if (!user && role) {
    user = dbStore.users.find((u) => u.role === role);
  }
  if (!user) {
    user = dbStore.users[0];
  }

  const token = signJwtToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  });

  const assignedApartments = dbStore.rooms.filter((r) => r.owner_user_id === user!.id);

  res.json({
    token,
    user,
    assigned_apartments: assignedApartments
  });
};

export const getCurrentUser = (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = dbStore.users.find((u) => u.id === req.user!.id) || dbStore.users[0];
  const assignedApartments = dbStore.rooms.filter((r) => r.owner_user_id === user.id);

  res.json({
    user,
    assigned_apartments: assignedApartments
  });
};

export const listAllUsers = (_req: AuthenticatedRequest, res: Response): void => {
  res.json({
    users: dbStore.users
  });
};
