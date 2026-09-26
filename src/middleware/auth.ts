import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: typeof users.$inferSelect;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token header' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Support direct 1-click Demo Tokens for instant demo login
  if (token === 'demo-token-manager' || token === 'demo-token-staff') {
    const role = token === 'demo-token-manager' ? 'manager' : 'staff';
    const demoUid = role === 'manager' ? 'stocksense-system-admin' : 'stocksense-staff-demo';
    let dbUser = await db.query.users.findFirst({
      where: eq(users.uid, demoUid),
    });
    if (!dbUser) {
      dbUser = await db.query.users.findFirst({
        where: eq(users.role, role),
      });
    }
    if (!dbUser) {
      const inserted = await db
        .insert(users)
        .values({
          uid: demoUid,
          email: `${role}@stocksense.corp`,
          name: role === 'manager' ? 'Chief Inventory Manager' : 'Warehouse Operations Staff',
          role,
        })
        .returning();
      dbUser = inserted[0];
    }
    req.user = {
      uid: dbUser.uid,
      email: dbUser.email,
      name: dbUser.name,
    } as any;
    req.dbUser = dbUser;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    // Lookup or synchronize dbUser
    let dbUser = await db.query.users.findFirst({
      where: eq(users.uid, decodedToken.uid),
    });

    if (!dbUser) {
      const email = decodedToken.email || 'user@stocksense.local';
      const name = decodedToken.name || email.split('@')[0];
      // Default to manager for first or main user
      const countResult = await db.select({ count: users.id }).from(users);
      const isFirst = countResult.length === 0;
      const role = isFirst ? 'manager' : 'staff';

      const inserted = await db.insert(users).values({
        uid: decodedToken.uid,
        email,
        name,
        role,
        avatarUrl: decodedToken.picture || '',
      }).returning();
      dbUser = inserted[0];
    }

    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized: No user session' });
    }
    if (!allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: `Forbidden: Requires role [${allowedRoles.join(', ')}]` });
    }
    next();
  };
};
