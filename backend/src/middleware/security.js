const rateLimit = require('express-rate-limit');
const helmet    = require('helmet');

// ── Security Headers (anti-XSS, anti-clickjacking, anti-sniffing) ──────────
const securityHeaders = helmet({
  contentSecurityPolicy: false,  // Let frontend handle CSP
  crossOriginEmbedderPolicy: false,
});

// ── Global Rate Limiter (anti-DDoS) ────────────────────────────────────────
// Max 100 requests per minute per IP across all routes
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans quelques instants.' },
});

// ── Auth Rate Limiter (anti-brute-force on login/register/reset) ───────────
// Max 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,  // Only count failed attempts
});

// ── Account creation limiter ───────────────────────────────────────────────
// Max 3 account creations per hour per IP
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,
  message: { error: 'Trop de créations de compte. Réessayez plus tard.' },
});

// ── Password reset limiter ─────────────────────────────────────────────────
// Max 3 reset requests per 15 minutes per IP
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Trop de demandes de réinitialisation. Réessayez dans 15 minutes.' },
});

// ── Input sanitizer middleware ──────────────────────────────────────────────
// Strips dangerous characters from req.body, req.query, req.params
const sanitizeInput = (req, res, next) => {
  const clean = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        // Remove $ prefixes (NoSQL injection), < > (XSS), null bytes
        obj[key] = obj[key]
          .replace(/\$/g, '')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\0/g, '');
      } else if (typeof obj[key] === 'object') {
        clean(obj[key]);
      }
    }
    return obj;
  };
  if (req.body)   clean(req.body);
  if (req.query)  clean(req.query);
  if (req.params) clean(req.params);
  next();
};

module.exports = {
  securityHeaders,
  globalLimiter,
  authLimiter,
  createAccountLimiter,
  resetLimiter,
  sanitizeInput,
};
