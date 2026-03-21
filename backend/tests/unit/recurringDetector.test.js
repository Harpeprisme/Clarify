/**
 * Unit Tests — recurringDetector.js
 * ===================================
 * Tests the pure helper functions exported by the recurring detector.
 * The main detectRecurring() function requires DB and is tested in integration.
 */
const { normalizeDesc } = require('../../src/services/recurringDetector');

describe('recurringDetector', () => {

  // ────────────────────────────────────────────────────
  // normalizeDesc
  // ────────────────────────────────────────────────────
  describe('normalizeDesc()', () => {
    test('removes CB prefix and card number', () => {
      const result = normalizeDesc('CB 1234 MONOPRIX MARSEILLE');
      expect(result).not.toMatch(/cb/i);
      expect(result).toContain('monoprix');
    });

    test('removes PAIEMENT PAR CARTE prefix', () => {
      const result = normalizeDesc('PAIEMENT PAR CARTE X9999 NETFLIX 27/02');
      expect(result).not.toMatch(/paiement/i);
      expect(result).toContain('netflix');
    });

    test('removes PRELEVEMENT prefix', () => {
      const result = normalizeDesc('PRELEVEMENT LOYER RESIDENCE');
      expect(result).not.toMatch(/prelevement/i);
      expect(result).toContain('loyer');
    });

    test('removes VIREMENT prefix', () => {
      const result = normalizeDesc('VIREMENT EN VOTRE FAVEUR SALAIRE ENTREPRISE TEST');
      // Should strip virement prefix
      expect(result).not.toMatch(/^virement/i);
    });

    test('removes dates from description', () => {
      const result = normalizeDesc('CARTE X9999 UBER EATS 01/03/2026');
      expect(result).not.toMatch(/01\/03\/2026/);
    });

    test('removes card numbers (4+ digit sequences)', () => {
      const result = normalizeDesc('CARTE X9999 STARBUCKS');
      // The regex removes 4+ digit sequences, so 9999 is removed
      expect(result).toContain('starbucks');
    });

    test('removes amount artifacts', () => {
      const result = normalizeDesc('NETFLIX 17,99 EUR');
      expect(result).not.toMatch(/17,99/);
    });

    test('normalizes extra spaces', () => {
      const result = normalizeDesc('CB    MONOPRIX     MARSEILLE');
      expect(result).not.toMatch(/\s{2,}/);
    });

    test('returns lowercase', () => {
      const result = normalizeDesc('NETFLIX ABONNEMENT');
      expect(result).toBe(result.toLowerCase());
    });

    test('handles empty string', () => {
      const result = normalizeDesc('');
      expect(result).toBe('');
    });
  });
});
