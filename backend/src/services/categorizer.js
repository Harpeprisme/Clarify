const prisma = require('../config/prisma');

/**
 * Categorize a transaction based on its description and amount
 * Uses global rules and user-defined rules.
 */
const categorizeTransaction = async (description, amount, userId) => {
  const descLower = description.toLowerCase();
  
  // 1. Check rules
  const rules = await prisma.categoryRule.findMany({
    where: {
        OR: [
            { userId: null },
            { userId: userId || null }
        ]
    },
    include: { category: true },
    orderBy: [
        { userId: 'desc' }, // User rules first
        { priority: 'desc' }
    ],
  });

  for (const rule of rules) {
    if (descLower.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }

  // 2. Default logic if no rules match
  let defaultCategoryName = 'Autres';

  const keywords = {
    'Logement': ['loyer', 'edf', 'engie', 'eau', 'suez', 'veolia', 'assurance habitation'],
    'Alimentation': ['auchan', 'carrefour', 'leclerc', 'intermarche', 'lidl', 'aldi', 'boulangerie', 'resto', 'restaurant', 'ubereats', 'deliveroo', 'monoprix', 'courses'],
    'Transport': ['sncf', 'ratp', 'navigo', 'total', 'esso', 'bp', 'shell', 'peage', 'vinci', 'parking', 'uber ', 'taxi', 'blablacar'],
    'Abonnements': ['netflix', 'spotify', 'amazon prime', 'canal+', 'orange', 'sfr', 'bouygues', 'free', 'sosh', 'apple', 'google', 'gym', 'basic fit', 'fitness park'],
    'Loisirs': ['cinema', 'ugc', 'pathe', 'fnac', 'micromania', 'steam', 'playstation', 'nintendo', 'decathlon'],
    'Santé': ['pharmacie', 'medecin', 'doctolib', 'mutuelle', 'hopital', 'dentiste', 'opticien'],
    'Impôts': ['dgfip', 'impot', 'tresor public', 'taxe'],
    'Épargne': ['virement lep', 'virement pea', 'virement livret'],
  };

  for (const [catName, keys] of Object.entries(keywords)) {
    if (keys.some(k => descLower.includes(k))) {
      defaultCategoryName = catName;
      break;
    }
  }

  // Handle special cases based on amount types
  if (defaultCategoryName === 'Autres' && amount > 0) {
    if (descLower.includes('salaire') || descLower.includes('paie') || descLower.includes('virement cpam') || descLower.includes('caf ')) {
      defaultCategoryName = 'Revenus';
    }
  }

  // Retrieve the default category from DB
  const category = await prisma.category.findUnique({
    where: { name: defaultCategoryName }
  });

  // Fallback to exactly 'Autres' if standard category was somehow deleted
  if (!category) {
    return await prisma.category.findUnique({ where: { name: 'Autres' } });
  }

  return category;
};

module.exports = { categorizeTransaction };
