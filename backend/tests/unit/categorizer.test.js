/**
 * Unit Tests — categorizer.js
 * ============================
 * Tests the keyword-based categorization engine.
 * Mocks Prisma to avoid DB dependency for pure logic tests.
 */

// Mock Prisma before requiring the module
jest.mock('../../src/config/prisma', () => ({
  categoryRule: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  category: {
    findFirst: jest.fn().mockImplementation(({ where }) => {
      // Simulate the DB returning a category object for known names
      const categories = {
        'Alimentation': { id: 1, name: 'Alimentation', color: '#FF6384' },
        'Transport': { id: 2, name: 'Transport', color: '#36A2EB' },
        'Logement': { id: 3, name: 'Logement', color: '#FFCE56' },
        'Abonnements': { id: 4, name: 'Abonnements', color: '#4BC0C0' },
        'Loisirs': { id: 5, name: 'Loisirs', color: '#9966FF' },
        'Santé': { id: 6, name: 'Santé', color: '#FF9F40' },
        'Impôts': { id: 7, name: 'Impôts', color: '#C9CBCF' },
        'Épargne': { id: 8, name: 'Épargne', color: '#27AE60' },
        'Investissement': { id: 9, name: 'Investissement', color: '#2ECC71' },
        'Revenus': { id: 10, name: 'Revenus', color: '#27AE60' },
        'Virement': { id: 11, name: 'Virement', color: '#3498DB' },
        'Autres': { id: 12, name: 'Autres', color: '#6B7280' },
      };
      return Promise.resolve(categories[where.name] || null);
    }),
  },
}));

const { categorizeTransaction } = require('../../src/services/categorizer');

describe('categorizer', () => {

  // ────────────────────────────────────────────────────
  // Alimentation
  // ────────────────────────────────────────────────────
  describe('Alimentation', () => {
    test('MONOPRIX → Alimentation', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 MONOPRIX MARSEILLE 09/03', -45.20, 1);
      expect(cat.name).toBe('Alimentation');
    });

    test('CARREFOUR → Alimentation', async () => {
      const cat = await categorizeTransaction('CB CARREFOUR CITY 12345', -32.50, 1);
      expect(cat.name).toBe('Alimentation');
    });

    test('UBER EATS → Alimentation', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 UBER EATS 01/03', -18.50, 1);
      expect(cat.name).toBe('Alimentation');
    });

    test('BOULANGERIE → Alimentation', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 BOULANGERIE DU COIN 08/03', -4.50, 1);
      expect(cat.name).toBe('Alimentation');
    });

    test('STARBUCKS → Alimentation', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 STARBUCKS MARSEILLE 19/02', -6.20, 1);
      expect(cat.name).toBe('Alimentation');
    });
  });

  // ────────────────────────────────────────────────────
  // Transport
  // ────────────────────────────────────────────────────
  describe('Transport', () => {
    test('TOTALENERGIES → Transport', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 TOTALENERGIES 07/03', -65.00, 1);
      expect(cat.name).toBe('Transport');
    });

    test('AIR FRANCE → Transport', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 AIR FRANCE 04/02', -245.00, 1);
      expect(cat.name).toBe('Transport');
    });
  });

  // ────────────────────────────────────────────────────
  // Logement
  // ────────────────────────────────────────────────────
  describe('Logement', () => {
    test('LOYER → Logement', async () => {
      const cat = await categorizeTransaction('PRELEVEMENT LOYER RESIDENCE', -850.00, 1);
      expect(cat.name).toBe('Logement');
    });

    test('EDF → Logement', async () => {
      const cat = await categorizeTransaction('PRELEVEMENT EDF MENSUEL', -75.00, 1);
      expect(cat.name).toBe('Logement');
    });

    test('LEROY MERLIN → Logement', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 LEROY MERLIN 11/02', -42.30, 1);
      expect(cat.name).toBe('Logement');
    });
  });

  // ────────────────────────────────────────────────────
  // Abonnements
  // ────────────────────────────────────────────────────
  describe('Abonnements', () => {
    test('NETFLIX → Abonnements', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 NETFLIX 27/02', -17.99, 1);
      expect(cat.name).toBe('Abonnements');
    });

    test('SPOTIFY → Abonnements', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 SPOTIFY ABONNEMENT 31/01', -10.99, 1);
      expect(cat.name).toBe('Abonnements');
    });
  });

  // ────────────────────────────────────────────────────
  // Santé
  // ────────────────────────────────────────────────────
  describe('Santé', () => {
    test('PHARMACIE → Santé', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 PHARMACIE CENTRALE 24/02', -12.40, 1);
      expect(cat.name).toBe('Santé');
    });

    test('AMELI (remboursement) → Santé', async () => {
      const cat = await categorizeTransaction('VIREMENT EN VOTRE FAVEUR REMBOURSEMENT AMELI', 28.50, 1);
      expect(cat.name).toBe('Santé');
    });
  });

  // ────────────────────────────────────────────────────
  // Loisirs
  // ────────────────────────────────────────────────────
  describe('Loisirs', () => {
    test('FNAC → Loisirs', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 FNAC MARSEILLE 14/02', -129.00, 1);
      expect(cat.name).toBe('Loisirs');
    });

    test('AMAZON → Loisirs', async () => {
      const cat = await categorizeTransaction('PAIEMENT PAR CARTE X9999 AMAZON MARKTP 02/03', -22.99, 1);
      expect(cat.name).toBe('Loisirs');
    });
  });

  // ────────────────────────────────────────────────────
  // Revenus
  // ────────────────────────────────────────────────────
  describe('Revenus', () => {
    test('SALAIRE → Revenus', async () => {
      const cat = await categorizeTransaction('VIREMENT EN VOTRE FAVEUR SALAIRE ENTREPRISE TEST', 2850.00, 1);
      expect(cat.name).toBe('Revenus');
    });

    test('uncategorized positive amount → Revenus (fallback)', async () => {
      const cat = await categorizeTransaction('VIREMENT EN VOTRE FAVEUR VIR INST DE MME DURAND LUCIE', 30.00, 1);
      expect(cat.name).toBe('Revenus');
    });
  });

  // ────────────────────────────────────────────────────
  // Autres (fallback for negative)
  // ────────────────────────────────────────────────────
  describe('Fallback', () => {
    test('unrecognized negative transaction → Autres', async () => {
      const cat = await categorizeTransaction('PAIEMENT QUELQUE CHOSE INCONNU XYZ', -50.00, 1);
      expect(cat.name).toBe('Autres');
    });
  });
});
