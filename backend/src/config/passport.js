const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prisma');
const jwt = require('jsonwebtoken');

const getBackendUrl = () => {
  return process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://deployclarify-production.up.railway.app' : `http://localhost:${process.env.PORT || 3001}`);
};

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌ ERREUR: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquant dans les variables d\'environnement.');
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'missing',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'missing',
  callbackURL: `${getBackendUrl()}/api/auth/google/callback`,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const name  = profile.displayName;
    const avatarUrl = profile.photos?.[0]?.value;
    const googleId = profile.id;

    if (!email) {
      return done(new Error('No email returned from Google'), null);
    }

    // Find or create by googleId first, then by email
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        // Link existing email account to Google
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatarUrl: avatarUrl || user.avatarUrl }
        });
      } else {
        // Create user with conditional ADMIN role
        const count = await prisma.user.count();
        user = await prisma.user.create({
          data: { 
            name, email, googleId, avatarUrl, 
            role: (email === 'admin@clarify.app' || count === 0) ? 'ADMIN' : 'READER'
          }
        });
      }
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
