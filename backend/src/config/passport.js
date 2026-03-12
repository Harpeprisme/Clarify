const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prisma');
const jwt = require('jsonwebtoken');

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌ ERREUR: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquant dans les variables d\'environnement.');
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'missing',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'missing',
  callbackURL: `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`}/api/auth/google/callback`,
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
        // Brand new Google user
        user = await prisma.user.create({
          data: { name, email, googleId, avatarUrl, role: 'ADMIN' }
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
