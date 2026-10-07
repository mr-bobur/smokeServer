import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { dbStore, isMysqlConnected, mysqlPool } from './database';
import { UserRecord } from '../types';

export const configurePassport = (): void => {
  const clientID = process.env.GOOGLE_CLIENT_ID || 'smart-building-google-client-id.apps.googleusercontent.com';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'smart-building-google-client-secret';
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value || `${googleId}@gmail.com`;
          const name = profile.displayName || 'Smart Building User';
          const avatarUrl = profile.photos?.[0]?.value || null;

          let existingUser = dbStore.users.find((u) => u.google_id === googleId || u.email === email);

          if (!existingUser) {
            const newId = dbStore.users.length + 1;
            const nowIso = new Date().toISOString();
            existingUser = {
              id: newId,
              google_id: googleId,
              email,
              name,
              avatar_url: avatarUrl,
              role: 'user',
              phone_number: null,
              created_at: nowIso,
              updated_at: nowIso
            };
            dbStore.users.push(existingUser);

            if (isMysqlConnected && mysqlPool) {
              await mysqlPool.query(
                `INSERT INTO users (google_id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, 'user')`,
                [googleId, email, name, avatarUrl]
              );
            }
          }

          return done(null, existingUser as unknown as Express.User);
        } catch (err) {
          return done(err as Error, undefined);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, (user as UserRecord).id);
  });

  passport.deserializeUser((id: number, done) => {
    const found = dbStore.users.find((u) => u.id === id);
    done(null, (found as unknown as Express.User) || null);
  });
};
