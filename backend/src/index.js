const express = require('express');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');

dotenv.config();

const passport = require('./config/passport');
const { authenticate } = require('./middleware/auth');

const app = express();
app.enable('trust proxy'); // Required for OAuth behind Railway/Render/Heroku reverse proxies
const PORT = process.env.PORT || 3001;



// ── 2. CORS Configuration ───────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://deployclarify.vercel.app',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : [])
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow Postman / server-to-server
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(ao => ao.trim().replace(/\/$/, '') === cleanOrigin);
    callback(isAllowed ? null : new Error(`CORS blocked: ${origin}`), isAllowed);
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── 3. Session & Passport ───────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: true, // Needed for many OAuth providers to store state before auth
  cookie: { secure: false, maxAge: 1000 * 60 * 15 } // 15 min session for OAuth redirect
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Logger (after auth) ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || 'N/A';
  const userId = req.user ? req.user.id : 'anonymous';
  console.log(`📡 [${req.method}] ${req.url} | User: ${userId} | Params: ${JSON.stringify(req.query)} | Origin: ${origin}`);
  next();
});

// ── Public Routes (no auth needed) ──────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// Health check (public)
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Protected Routes (JWT required) ─────────────────────────────────────────
app.use('/api/accounts', authenticate, require('./routes/accounts'));
app.use('/api/transactions', authenticate, require('./routes/transactions'));
app.use('/api/categories', authenticate, require('./routes/categories'));
app.use('/api/budgets', authenticate, require('./routes/budgets'));
app.use('/api/rules', authenticate, require('./routes/rules'));
app.use('/api/import', authenticate, require('./routes/import'));
app.use('/api/dashboard', authenticate, require('./routes/dashboard'));
app.use('/api/charts', authenticate, require('./routes/charts'));
app.use('/api/analysis', authenticate, require('./routes/analysis'));
app.use('/api/export', authenticate, require('./routes/export'));
app.use('/api/users', authenticate, require('./routes/users'));

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── Bootstrap: ensure admin account ─────────────────────────────────────────
const prisma = require('./config/prisma');

async function bootstrap() {
  try {
    const bcrypt = require('bcryptjs');
    // Default admin password — user can change it via their profile
    const defaultHash = await bcrypt.hash('Admin2024!', 12);

    await prisma.user.upsert({
      where:  { email: 'admin@clarify.app' },
      update: { role: 'ADMIN' },  // Only force role, preserve any password the admin set
      create: {
        name: 'Admin',
        email: 'admin@clarify.app',
        role: 'ADMIN',
        passwordHash: defaultHash,
      }
    });
    console.log('✅ Bootstrap: admin@clarify.app → ADMIN');
  } catch (err) {
    console.error('⚠️  Bootstrap warning:', err.message);
  }
}

app.listen(PORT, async () => {
  await bootstrap();
  const { startDailyDigest } = require('./jobs/dailyDigest');
  startDailyDigest();
  console.log(`🚀 Clarify API running on http://localhost:${PORT}`);
});

module.exports = app;
