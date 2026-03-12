const prisma = require('../config/prisma');

/**
 * Categorize a transaction based on its description and amount
 * Uses global rules and user-defined rules.
 */
const categorizeTransaction = async (description, amount, userId) => {
  const descLower = description.toLowerCase();
  console.log(`[Categorizer] Input: "${description}" | User: ${userId}`);
  
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
      console.log(`[Categorizer] Rule match: "${rule.keyword}" -> ${rule.category.name}`);
      return rule.category;
    }
  }

  // 2. Default logic if no rules match
  let defaultCategoryName = 'Autres';

  const keywords = {
    'Logement': ['loyer', 'edf', 'engie', 'eau', 'suez', 'veolia', 'assurance habitation', 'leroy merlin', 'castorama', 'bricorama', 'ikea', 'but', 'conforama', 'habitat', 'axa assurance', 'allianz', 'pacifica', 'macif', 'maif'],
    'Alimentation': ['auchan', 'carrefour', 'leclerc', 'intermarche', 'lidl', 'aldi', 'boulangerie', 'resto', 'restaurant', 'ubereats', 'deliveroo', 'monoprix', 'courses', 'picard', 'naturalia', 'biocoop', 'grand frais', 'casino', 'franprix', 'super u', 'pizzeria', 'sushi', 'mcdonald', 'burger king', 'starbucks', 'paul', 'brioche doree'],
    'Transport': ['sncf', 'ratp', 'navigo', 'total', 'esso', 'bp', 'shell', 'peage', 'vinci', 'parking', 'uber ', 'taxi', 'blablacar', 'air france', 'ryanair', 'easyjet', 'transavia', 'amende', 'vroomly', 'norauto', 'feu vert'],
    'Abonnements': ['netflix', 'spotify', 'amazon prime', 'canal+', 'orange', 'sfr', 'bouygues', 'free', 'sosh', 'apple', 'google', 'gym', 'basic fit', 'fitness park', 'disney+', 'deezer', 'icloud', 'microsoft'],
    'Loisirs': ['cinema', 'ugc', 'pathe', 'fnac', 'micromania', 'steam', 'playstation', 'nintendo', 'decathlon', 'intersport', 'go sport', 'cultura', 'billetterie', 'theatre', 'musee', 'parc de loisirs', 'darty', 'boulanger', 'amazon marktp', 'cdiscount'],
    'Santé': ['pharmacie', 'medecin', 'doctolib', 'mutuelle', 'hopital', 'dentiste', 'opticien', 'ameli', 'cpam', 'laboratoire', 'radiologie'],
    'Impôts': ['dgfip', 'impot', 'tresor public', 'taxe', 'amendes.gouv'],
    'Épargne': ['virement lep', 'virement pea', 'virement livret', 'pel ', 'assurance vie', 'boursobank', 'fortuneo'],
    'Virement': ['virement ', 'vir ', 'transfert', 'remboursement'],
  };

  for (const [catName, keys] of Object.entries(keywords)) {
    const matchedKey = keys.find(k => descLower.includes(k));
    if (matchedKey) {
      console.log(`[Categorizer] Keyword match: "${matchedKey}" -> ${catName}`);
      defaultCategoryName = catName;
      break;
    }
  }

  // Handle special cases based on amount types
  if (defaultCategoryName === 'Autres' && amount > 0) {
    if (descLower.includes('salaire') || descLower.includes('paie') || descLower.includes('virement cpam') || descLower.includes('caf ')) {
      console.log(`[Categorizer] Special case match: Revenus`);
      defaultCategoryName = 'Revenus';
    }
  }

  // Retrieve the default category from DB
  const category = await prisma.category.findFirst({
    where: { name: defaultCategoryName }
  });

  // Fallback to exactly 'Autres' if standard category was somehow deleted
  if (!category) {
    return await prisma.category.findFirst({ where: { name: 'Autres' } });
  }

  return category;
};

module.exports = { categorizeTransaction };
