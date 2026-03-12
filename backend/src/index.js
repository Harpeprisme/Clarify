const express = require('express');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');

dotenv.config();

const passport = require('./config/passport');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://deployclarify.vercel.app',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : [])
].filter(Boolean);

console.log('📡 Origines autorisées par CORS :', allowedOrigins.join(', '));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(ao => ao.trim().replace(/\/$/, '') === cleanOrigin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS REFUSÉ pour : "${origin}"`);
      callback(null, false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers crash on 204
}));

// ── Global Logger (For Debugging CORS & Requests) ───────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || 'N/A';
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${origin}`);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session (needed for passport OAuth flow only)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 15 } // 15 min session for OAuth redirect
}));

app.use(passport.initialize());
app.use(passport.session());

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

app.listen(PORT, () => {
  console.log(`🚀 Clarify API running on http://localhost:${PORT}`);
});

module.exports = app;
