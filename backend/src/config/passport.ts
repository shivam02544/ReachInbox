import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { config } from './env';
import { prisma } from './prisma';
import { logger } from '../utils/logger';

export function configurePassport(): typeof passport {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          const googleId = profile.id;
          const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${googleId}@google.user`;
          const name = profile.displayName || 'Google User';
          const avatarUrl = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;

          logger.info('API', `[OAuth Profile Received] Google ID: ${googleId}, Email: ${email}`);

          let user = await prisma.user.findUnique({
            where: { googleId },
          });

          if (user) {
            // Update existing user details if updated
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                name,
                avatarUrl,
              },
            });
            logger.info('API', `[OAuth User Updated] Reused existing User ID: ${user.id}`);
          } else {
            // Create new Google User
            user = await prisma.user.create({
              data: {
                googleId,
                email,
                name,
                avatarUrl,
              },
            });
            logger.info('API', `[OAuth User Created] Created new User ID: ${user.id}`);

            // Auto-associate default Ethereal senders for development testing
            await prisma.sender.createMany({
              data: [
                {
                  userId: user.id,
                  email: 'senderA@example.com',
                  displayName: 'Sender Alpha',
                  smtpHost: config.ethereal.host,
                  smtpPort: config.ethereal.port,
                  smtpUser: config.ethereal.user,
                  smtpPassword: config.ethereal.pass,
                },
                {
                  userId: user.id,
                  email: 'senderB@example.com',
                  displayName: 'Sender Beta',
                  smtpHost: config.ethereal.host,
                  smtpPort: config.ethereal.port,
                  smtpUser: config.ethereal.user,
                  smtpPassword: config.ethereal.pass,
                },
              ],
            });
            logger.info('API', `[OAuth Senders Created] Default Ethereal Senders associated with User ID: ${user.id}`);
          }

          return done(null, user);
        } catch (err: any) {
          logger.error('API', '[OAuth Error] Error in Passport Google Strategy callback', err);
          return done(err, undefined);
        }
      }
    )
  );

  return passport;
}
