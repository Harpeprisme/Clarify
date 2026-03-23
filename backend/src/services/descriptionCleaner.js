/**
 * Description Cleaner Service
 * ============================
 * Converts raw French bank statement descriptions into clean,
 * human-readable transaction names.
 *
 * Example:
 *   "PAIEMENT PAR CARTE X5649 CARREFOUR EXPRES MAR 19/03"
 *   → "Carrefour Express"
 */

// ── Cleaning rules (ordered by priority) ─────────────────────────────────────
// Each rule: { pattern: RegEx, transform: (match) => string }
const RULES = [
  // ── Prélèvements SEPA — extract merchant name ──────────────────────────────
  {
    p: /^PRLV\s+SEPA\s+(.+?)(?:\s+ECH\/|\s+ID|\s+EMETTEUR|\/REF|$)/i,
    fn: ([, name]) => capitalize(cleanMerchant(name)),
  },
  {
    p: /^PRELEVEMENT\s+SEPA\s+(.+?)(?:\s+ECH\/|\s+ID|\s+\/REF|$)/i,
    fn: ([, name]) => capitalize(cleanMerchant(name)),
  },

  // ── Virement reçu ──────────────────────────────────────────────────────────
  {
    p: /^VIR\s+(?:SCT\s+INST\s+)?RECU\s+\/DE\s+(.+?)(?:\s+\/REF|\s+\/MOTIF|$)/i,
    fn: ([, from]) => `Virement reçu – ${titleCase(cleanRef(from))}`,
  },
  {
    p: /^VIR\s+(?:SCT\s+)?RECU\s+\/DE\s+(.+?)(?:\s+\/REF|\s+\/MOTIF|$)/i,
    fn: ([, from]) => `Virement reçu – ${titleCase(cleanRef(from))}`,
  },
  {
    p: /^VIRSCTINSTRECU\/DE(.+?)(?:\/REF|\/MOTIF|$)/i,
    fn: ([, from]) => `Virement reçu – ${titleCase(cleanRef(from))}`,
  },
  {
    p: /^VIRSCTRECU\/DE(.+?)(?:\/REF|\/MOTIF|$)/i,
    fn: ([, from]) => `Virement reçu – ${titleCase(cleanRef(from))}`,
  },
  {
    p: /^VIRCPTRECU\/DE(.+?)(?:\/REF|\/MOTIF|$)/i,
    fn: ([, from]) => `Virement reçu – ${titleCase(cleanRef(from))}`,
  },

  // ── Virement émis ──────────────────────────────────────────────────────────
  {
    p: /^VIR(?:EMENT)?\s+(?:SEPA\s+)?(?:EMIS|FAVEUR|WEB|PERMANENT)(?:\s+TIERS)?(?:\s+VR\.?\s+PERMANENT)?\s+(.+?)(?:\s+\/REF|\s+\/BEN|\s+\/MOTIF|$)/i,
    fn: ([, to]) => `Virement – ${titleCase(cleanRef(to))}`,
  },
  {
    p: /^VIREMENTSEPAEMIS\/MOTIF(.+?)(?:\/BEN|\/REF|$)/i,
    fn: ([, motif]) => `Virement – ${titleCase(motif.trim())}`,
  },
  {
    p: /^VIR\s+EMIS\s+WEB\s+(.+?)(?:\s+\/REF|$)/i,
    fn: ([, to]) => `Virement – ${titleCase(cleanRef(to))}`,
  },
  {
    p: /^VIREMENTFAVEURTIERS.*\/MOTIF(.+?)(?:\/REF|$)/i,
    fn: ([, motif]) => `Virement – ${titleCase(motif.trim())}`,
  },

  // ── Paiement carte ────────────────────────────────────────────────────────
  {
    p: /^PAIE?MENT\s+(?:PAR\s+)?CARTE\s+\S+\s+(.+?)(?:\s+[A-Z]{3}\s+\d{2}\/\d{2}|\s+\d{2}\/\d{2}|$)/i,
    fn: ([, merchant]) => capitalize(cleanMerchant(merchant)),
  },
  {
    p: /^FACTURE\(S\)\s+CARTE\s+\S+\s+DU\s+\d+\s+(.+)/i,
    fn: ([, merchant]) => capitalize(cleanMerchant(merchant)),
  },
  {
    p: /^DU\s+\d+\s+(.+)/i,
    fn: ([, merchant]) => capitalize(cleanMerchant(merchant)),
  },

  // ── Compact CA format: card payment without spaces ─────────────────────────
  {
    p: /^PAIEMENTPARTECARTE\S+(.+?)(?:[A-Z]{3}\d{2}\/\d{2}|$)/i,
    fn: ([, merchant]) => capitalize(cleanMerchant(merchant)),
  },
  {
    p: /^FACTURES?\s*\(S\)?\s*CARTE\s*\S+\s*(.+)/i,
    fn: ([, merchant]) => capitalize(cleanMerchant(merchant)),
  },

  // ── Retrait DAB/ATM ────────────────────────────────────────────────────────
  {
    p: /^RETRAIT\s+(?:DAB\s+)?(.+?)(?:\s+\d{2}\/\d{2}|$)/i,
    fn: ([, loc]) => `Retrait – ${titleCase(loc.trim())}`,
  },
  {
    p: /^RETRAIT\s+ESPECES/i,
    fn: () => 'Retrait espèces',
  },

  // ── Chèques ───────────────────────────────────────────────────────────────
  {
    p: /^REMISE\s+CHE?QUE?\s*\d*/i,
    fn: () => 'Remise chèque',
  },
  {
    p: /^CHE?QUE?\s+\d+/i,
    fn: () => 'Chèque',
  },

  // ── Intérêts livret ───────────────────────────────────────────────────────
  {
    p: /^INTER[EÊ]TS?\s+(.+)/i,
    fn: ([, name]) => `Intérêts – ${titleCase(name.trim())}`,
  },

  // ── Cotisation / frais ────────────────────────────────────────────────────
  {
    p: /^COTISATION\s+(.+?)(?:\s+\/|\s+\d{2}\/\d{2}|$)/i,
    fn: ([, name]) => `Cotisation – ${titleCase(name.trim())}`,
  },
  {
    p: /^FRAIS\s+(.+?)(?:\s+\/|\s+\d{2}\/\d{2}|$)/i,
    fn: ([, name]) => `Frais – ${titleCase(name.trim())}`,
  },

  // ── Salaire / remunération ────────────────────────────────────────────────
  {
    p: /^(?:VIREMENT\s+)?SALAIRE\s+(.+)/i,
    fn: ([, from]) => `Salaire – ${titleCase(from.trim())}`,
  },

  // ── Remboursement ─────────────────────────────────────────────────────────
  {
    p: /^REMBOURSEMENT\s+(.+)/i,
    fn: ([, name]) => `Remboursement – ${titleCase(cleanRef(name))}`,
  },
];

// ── Named merchant mappings (for well-known brands) ──────────────────────────
const MERCHANT_MAP = [
  [/netflix/i, 'Netflix'],
  [/spotify/i, 'Spotify'],
  [/amazon(?:\s*prime)?/i, 'Amazon'],
  [/uber\s*eats/i, 'Uber Eats'],
  [/uber/i, 'Uber'],
  [/airbnb/i, 'Airbnb'],
  [/apple/i, 'Apple'],
  [/google/i, 'Google'],
  [/microsoft/i, 'Microsoft'],
  [/paypal/i, 'PayPal'],
  [/free\s*mobile/i, 'Free Mobile'],
  [/^free\b/i, 'Free'],
  [/sfr\b/i, 'SFR'],
  [/orange(?:\s*sa)?/i, 'Orange'],
  [/bouygues/i, 'Bouygues Telecom'],
  [/engie/i, 'Engie'],
  [/edf\b/i, 'EDF'],
  [/gaz\s*de\s*france/i, 'GDF Suez'],
  [/veolia/i, 'Veolia'],
  [/carrefour/i, 'Carrefour'],
  [/leclerc/i, 'E.Leclerc'],
  [/auchan/i, 'Auchan'],
  [/lidl/i, 'Lidl'],
  [/aldi/i, 'Aldi'],
  [/monoprix/i, 'Monoprix'],
  [/intermarche/i, 'Intermarché'],
  [/fleury\s*michon/i, 'Fleury Michon'],
  [/mcdonalds?|mcdonald/i, "McDonald's"],
  [/starbucks/i, 'Starbucks'],
  [/sncf|ter\b|tgv/i, 'SNCF'],
  [/ratp/i, 'RATP'],
  [/blablacar/i, 'BlaBlaCar'],
  [/uep\*/i, 'UGC Restos'],
  [/ugc\b/i, 'UGC Cinémas'],
  [/decathlon/i, 'Decathlon'],
  [/lacoste/i, 'Lacoste'],
  [/zara/i, 'Zara'],
  [/h&m/i, 'H&M'],
  [/fnac/i, 'Fnac'],
  [/darty/i, 'Darty'],
  [/boulanger/i, 'Boulanger'],
  [/leroy\s*merlin/i, 'Leroy Merlin'],
  [/castorama/i, 'Castorama'],
  [/ikea/i, 'IKEA'],
  [/payfit/i, 'PayFit'],
  [/alan\b/i, 'Alan'],
  [/malakoff/i, 'Malakoff Humanis'],
  [/harmonie/i, 'Harmonie Mutuelle'],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanRef(s) {
  return s
    .replace(/\/REF\S*/gi, '')
    .replace(/\/MOTIF.*/gi, '')
    .replace(/\/BEN.*/gi, '')
    .replace(/NOTPROVIDED/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMerchant(s) {
  // Remove card numbers, dates, country codes, trailing numbers
  return s
    .replace(/\b\d{4}XX+\d{4}\b/g, '')  // masked card number
    .replace(/\b\d{6}\b/g, '')           // 6-digit ref
    .replace(/\b\d{2}\/\d{2}\b/g, '')    // dates
    .replace(/\b[A-Z]{2,3}\b(?=\s|$)/g, '') // 2-3 letter codes (country codes etc)
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function titleCase(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

function applyMerchantMap(s) {
  for (const [re, name] of MERCHANT_MAP) {
    if (re.test(s)) return name;
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Clean a raw bank description into a short, human-readable name.
 * @param {string} raw - The raw bank description
 * @returns {string} - Clean description
 */
function cleanDescription(raw) {
  if (!raw || raw.trim().length === 0) return raw;

  const s = raw.trim();

  // First: check known merchant names directly in the raw string
  const mapped = applyMerchantMap(s);
  if (mapped) return mapped;

  // Try each rule
  for (const { p, fn } of RULES) {
    const m = s.match(p);
    if (m) {
      const cleaned = fn(m);
      if (cleaned && cleaned.length >= 2) {
        // Check if the cleaned result matches a known merchant
        const mappedCleaned = applyMerchantMap(cleaned);
        return mappedCleaned || cleaned;
      }
    }
  }

  // Fallback: capitalize and strip banking noise
  const fallback = cleanMerchant(s);
  const mappedFallback = applyMerchantMap(fallback);
  if (mappedFallback) return mappedFallback;

  // Last resort: just capitalize the first 50 chars
  return capitalize(fallback.substring(0, 60));
}

module.exports = { cleanDescription };
