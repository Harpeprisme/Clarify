/**
 * Unit Tests — csvParser.js
 * =========================
 * Tests the CSV parsing engine with real Crédit Agricole exports.
 */
const path = require('path');
const fs = require('fs');
const { parseCSV, detectFormat, parseDate, parseAmount } = require('../../src/services/csvParser');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

describe('csvParser', () => {
  // ────────────────────────────────────────────────────
  // parseAmount — European number format handling
  // ────────────────────────────────────────────────────
  describe('parseAmount()', () => {
    test('parses simple European decimal (45,20)', () => {
      expect(parseAmount('45,20')).toBe(45.20);
    });

    test('parses amount with space thousands separator (2 850,00)', () => {
      expect(parseAmount('2 850,00')).toBe(2850.00);
    });

    test('parses amount with dot thousands separator (1.000,50)', () => {
      expect(parseAmount('1.000,50')).toBe(1000.50);
    });

    test('returns 0 for empty string', () => {
      expect(parseAmount('')).toBe(0);
    });

    test('returns 0 for null/undefined', () => {
      expect(parseAmount(null)).toBe(0);
      expect(parseAmount(undefined)).toBe(0);
    });

    test('strips currency symbols (45,20 €)', () => {
      expect(parseAmount('45,20 €')).toBe(45.20);
      expect(parseAmount('$100.50')).toBe(100.50);
    });

    test('handles negative amounts (-200,00)', () => {
      expect(parseAmount('-200,00')).toBe(-200.00);
    });

    test('parses US-style format (1,000.50)', () => {
      expect(parseAmount('1,000.50')).toBe(1000.50);
    });
  });

  // ────────────────────────────────────────────────────
  // parseDate — multi-format date parsing
  // ────────────────────────────────────────────────────
  describe('parseDate()', () => {
    test('parses dd/MM/yyyy format (10/03/2026)', () => {
      const result = parseDate('10/03/2026');
      expect(result).not.toBeNull();
      const d = new Date(result);
      expect(d.getDate()).toBe(10);
      expect(d.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(d.getFullYear()).toBe(2026);
    });

    test('parses ISO format (2026-03-10)', () => {
      const result = parseDate('2026-03-10');
      expect(result).not.toBeNull();
      const d = new Date(result);
      expect(d.getFullYear()).toBe(2026);
    });

    test('returns null for empty/null', () => {
      expect(parseDate('')).toBeNull();
      expect(parseDate(null)).toBeNull();
    });

    test('returns null for garbage input', () => {
      expect(parseDate('not a date')).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────
  // detectFormat — CSV format detection
  // ────────────────────────────────────────────────────
  describe('detectFormat()', () => {
    test('detects Crédit Agricole courant format correctly', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const format = await detectFormat(buffer);

      expect(format.delimiter).toBe(';');
      expect(format.dateColumn).toBeTruthy();
      expect(format.skippedHeaderRows).toBeGreaterThan(0);
      // Should detect debit/credit columns
      expect(format.debitColumn || format.creditColumn || format.amountColumn).toBeTruthy();
    });

    test('detects Crédit Agricole épargne format correctly', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'epargne.csv'));
      const format = await detectFormat(buffer);

      expect(format.delimiter).toBe(';');
      expect(format.dateColumn).toBeTruthy();
    });

    test('provides sample rows', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const format = await detectFormat(buffer);

      expect(format.sampleRows).toBeDefined();
      expect(format.sampleRows.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────
  // parseCSV — Full CSV parsing
  // ────────────────────────────────────────────────────
  describe('parseCSV()', () => {
    test('parses courant.csv and returns 20 transactions', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const rows = await parseCSV(buffer);

      expect(rows.length).toBe(20);
    });

    test('parses epargne.csv and returns transactions', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'epargne.csv'));
      const rows = await parseCSV(buffer);

      expect(rows.length).toBeGreaterThan(0);
      // Épargne file has about 16 transactions
      expect(rows.length).toBeGreaterThanOrEqual(14);
    });

    test('transactions have required fields', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const rows = await parseCSV(buffer);

      for (const row of rows) {
        expect(row.date).toBeDefined();
        expect(row.description).toBeDefined();
        expect(typeof row.amount).toBe('number');
        expect(['INCOME', 'EXPENSE']).toContain(row.type);
      }
    });

    test('debit amounts are negative', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const rows = await parseCSV(buffer);

      // "MONOPRIX" should be a debit (expense)
      const monoprix = rows.find(r => r.description.includes('MONOPRIX'));
      expect(monoprix).toBeDefined();
      expect(monoprix.amount).toBeLessThan(0);
      expect(monoprix.type).toBe('EXPENSE');
    });

    test('credit amounts are positive', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const rows = await parseCSV(buffer);

      // "SALAIRE" should be a credit (income)
      const salaire = rows.find(r => r.description.includes('SALAIRE'));
      expect(salaire).toBeDefined();
      expect(salaire.amount).toBeGreaterThan(0);
      expect(salaire.type).toBe('INCOME');
    });

    test('specific amounts are correctly parsed', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const rows = await parseCSV(buffer);

      // MONOPRIX: 45,20 → -45.20
      const monoprix = rows.find(r => r.description.includes('MONOPRIX'));
      expect(monoprix.amount).toBeCloseTo(-45.20, 2);

      // SALAIRE: 2 850,00 → 2850.00
      const salaire = rows.find(r => r.description.includes('SALAIRE'));
      expect(salaire.amount).toBeCloseTo(2850.00, 2);

      // NETFLIX: 17,99 → -17.99
      const netflix = rows.find(r => r.description.includes('NETFLIX'));
      expect(netflix.amount).toBeCloseTo(-17.99, 2);
    });

    test('dates are valid ISO strings', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const rows = await parseCSV(buffer);

      for (const row of rows) {
        const d = new Date(row.date);
        expect(d.getFullYear()).toBeGreaterThanOrEqual(2025);
        expect(d.getFullYear()).toBeLessThanOrEqual(2027);
      }
    });

    test('multiline descriptions are cleaned up', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant.csv'));
      const rows = await parseCSV(buffer);

      for (const row of rows) {
        // No multi-line breaks in final descriptions
        expect(row.description).not.toMatch(/\n/);
        // No excessive spaces
        expect(row.description).not.toMatch(/\s{3,}/);
        // Not empty
        expect(row.description.trim().length).toBeGreaterThan(0);
      }
    });

    test('courant_test.csv also parses correctly', async () => {
      const buffer = fs.readFileSync(path.join(FIXTURES, 'courant_test.csv'));
      const rows = await parseCSV(buffer);

      expect(rows.length).toBe(20);
      // Should have the "test" variant of MONOPRIX
      const monoprix = rows.find(r => r.description.includes('MONOPRIX'));
      expect(monoprix).toBeDefined();
    });

    test('returns empty array for empty/garbage input', async () => {
      const rows = await parseCSV('');
      expect(rows).toEqual([]);
    });
  });
});
