const prisma = require('../config/prisma');

// ─────────────────────────────────────────────────────────────────────────────
// SMART CATEGORIZER v2
// Multi-layer approach:
//   1. User-defined rules (highest priority)
//   2. Score-based keyword matching on normalized description
//   3. Amount-based fallback heuristics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a bank transaction description to improve matching.
 * Removes bank-specific prefixes, dates, card numbers, amounts, and extra spaces.
 */
function normalizeDesc(raw) {
  return raw
    .toLowerCase()
    // Remove common French bank prefixes
    .replace(/^(cb\s*|vir(ement)?\s*|prlv(mt)?\s*|sepa\s*|carte\s*|ret(rait)?\s*|achat\s*|paiement\s*|facture\s*|avoir\s*|prelevement\s*|prelev\s*|rembt?\s*|rem\s*)/i, '')
    // Remove dates (01/02/24, 01022024, 01.02.2024)
    .replace(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g, '')
    .replace(/\b\d{8}\b/g, '')
    // Remove card numbers and short codes (4 digits)
    .replace(/\b\d{4,}\b/g, '')
    // Remove amounts like 1 234,56 or 12.50
    .replace(/\d+[.,]\d{2}/g, '')
    // Normalize spacing
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD DICTIONARY
// Each category maps to an array of [keyword, weight] pairs.
// weight 3 = strong match (brand name), weight 1 = weaker signal
// ─────────────────────────────────────────────────────────────────────────────
const KEYWORD_WEIGHTS = {
  'Alimentation': [
    // Grande distribution
    ['carrefour', 3], ['leclerc', 3], ['auchan', 3], ['intermarche', 3], ['intermarché', 3],
    ['lidl', 3], ['aldi', 3], ['monoprix', 3], ['franprix', 3], ['casino', 3],
    ['super u', 3], ['simply market', 3], ['netto', 3], ['picard', 3], ['naturalia', 3],
    ['biocoop', 3], ['grand frais', 3], ['metro', 2], ['costco', 3], ['g20', 2],
    ['cora', 3], ['match', 2], ['spar', 2],
    // Restauration
    ['mcdonald', 3], ["mc donald", 3], ['burger king', 3], ['kfc', 3], ['quick', 2],
    ['subway', 3], ['brioche doree', 3], ['paul ', 3], ['starbucks', 3],
    ['dominos', 3], ['pizza hut', 3], ['five guys', 3], ['nando', 3],
    ['restaurant', 2], ['resto ', 2], ['brasserie', 2], ['bistro', 2], ['snack', 2],
    ['pizzeria', 2], ['kebab', 2], ['sushi', 2], ['ramen', 2], ['traiteur', 2],
    ['boulangerie', 2], ['patisserie', 2], ['epicerie', 2], ['fromagerie', 2],
    // Livraison
    ['ubereats', 3], ['uber eats', 3], ['deliveroo', 3], ['just eat', 3],
    ['foodora', 3], ['frichti', 3],
    // Générique
    ['courses', 1], ['supermarche', 1], ['alimentation', 1], ['marche', 1],
  ],

  'Transport': [
    // Rail
    ['sncf', 3], ['tgv', 3], ['intercites', 3], ['oui.sncf', 3], ['ter ', 2],
    ['eurostar', 3], ['thalys', 3], ['ouigo', 3], ['izy', 3],
    // Urban
    ['ratp', 3], ['navigo', 3], ['rer ', 2], ['metro ', 2], ['tramway', 2],
    ['tisseo', 3], ['tcl ', 3], ['tam ', 2], ['keolis', 2],
    // VTC & taxi
    ['uber ', 3], ['bolt ', 3], ['kapten', 3], ['heetch', 3], ['taxi', 2], ['g7', 2],
    // Covoiturage & location
    ['blablacar', 3], ['drivy', 3], ['getaround', 3], ['sixt', 3], ['europcar', 3],
    ['hertz', 3], ['avis ', 3], ['rental', 2],
    // Carburant
    ['total ', 3], ['totalenergies', 3], ['esso', 3], ['bp ', 3], ['shell', 3],
    ['leclerc carburant', 3], ['intermarche carburant', 3], ['station', 2],
    // Autoroute & parking
    ['peage', 2], ['sanef', 3], ['vinci autoroute', 3], ['cofiroute', 3],
    ['parking', 2], ['indigo', 2], ['saemes', 2], ['effia', 2], ['flowbird', 2],
    // Aérien
    ['air france', 3], ['ryanair', 3], ['easyjet', 3], ['transavia', 3],
    ['vueling', 3], ['iberia', 3], ['lufthansa', 3],
    // Auto
    ['norauto', 3], ['feu vert', 3], ['midas', 3], ['speedy', 3],
    ['vroomly', 3], ['controle technique', 2], ['assurance auto', 2],
    // Vélo
    ['velib', 3], ['vcub', 3], ['nextbike', 3], ['lime ', 3], ['bird ', 3],
  ],

  'Logement': [
    // Énergie
    ['edf', 3], ['engie', 3], ['totalenergies elec', 3], ['eni ', 3],
    ['ilek', 3], ['ekwateur', 3], ['vattenfall', 3], ['plum energie', 3],
    // Eau
    ['eau ', 2], ['suez', 3], ['veolia', 3], ['saur', 3], ['sevesc', 3],
    // Loyer
    ['loyer', 3], ['charges', 2], ['syndic', 2], ['copropriete', 2],
    ['agence immobiliere', 2], ['propriet', 2], ['sarl immo', 2],
    // Assurances habitation
    ['axa', 3], ['allianz', 3], ['groupama', 3], ['macif', 3], ['maif', 3],
    ['mma ', 3], ['generali', 3], ['april', 3], ['luko', 3], ['wilov', 3],
    ['assurance habitation', 3], ['assurance logement', 3],
    // Télétravail/Internet
    ['orange', 2], ['sfr ', 2], ['free ', 2], ['bouygues', 2],
    // Travaux & deco
    ['leroy merlin', 3], ['castorama', 3], ['bricorama', 3], ['bricomarche', 3],
    ['mr bricolage', 3], ['brico depot', 3], ['ikea', 3], ['habitat', 3],
    ['but ', 3], ['conforama', 3], ['maison du monde', 3],
  ],

  'Abonnements': [
    // Streaming vidéo
    ['netflix', 3], ['disney+', 3], ['disney plus', 3], ['amazon prime', 3],
    ['canal+', 3], ['canalplus', 3], ['ocs ', 3], ['salto', 3], ['arte', 2],
    ['hbo', 3], ['paramount', 3], ['apple tv', 3], ['molotov', 3],
    // Streaming audio
    ['spotify', 3], ['deezer', 3], ['apple music', 3], ['tidal', 3],
    ['soundcloud', 3], ['amazon music', 3], ['napster', 3],
    // Presse & magazines
    ['presse', 2], ['le monde', 3], ['le figaro', 3], ['liberation', 3],
    ['l equipe', 3], ['mediapart', 3], ['courrier international', 3],
    // Cloud & software
    ['icloud', 3], ['google one', 3], ['dropbox', 3], ['adobe', 3],
    ['microsoft', 3], ['office 365', 3], ['notion', 3], ['slack', 3],
    // Téléphonie
    ['orange', 2], ['sfr', 2], ['free ', 2], ['bouygues', 2], ['sosh', 3],
    ['red by sfr', 3], ['giga', 2],
    // Sport & bien-être
    ['basic fit', 3], ['fitness park', 3], ['keep cool', 3], ['moving', 2],
    ['neoness', 3], ['gymlib', 3], ['classpass', 3], ['les mills', 3],
    // Gaming
    ['playstation', 3], ['xbox', 3], ['nintendo', 3], ['steam', 3], ['twitch', 3],
    // Divers abonnements
    ['abonnement', 2], ['mensuel', 1], ['subscription', 1],
  ],

  'Loisirs': [
    // Cinéma
    ['ugc', 3], ['pathe', 3], ['gaumont', 3], ['cinema', 2], ['mk2', 3],
    // Jeux & divertissements
    ['fnac', 3], ['micromania', 3], ['gamestop', 3], ['cdiscount jeux', 2],
    ['steam', 2], ['playstation store', 3], ['nintendo eshop', 3],
    // Culture
    ['musee', 2], ['exposition', 2], ['theatre', 3], ['opera', 3], ['concert', 2],
    ['fnac spectacles', 3], ['ticketmaster', 3], ['billetreduc', 3], ['yeticket', 3],
    ['billet', 2], ['spectacle', 2],
    // Sport
    ['decathlon', 3], ['intersport', 3], ['go sport', 3], ['stadium', 2],
    ['sport 2000', 3], ['footcenter', 3], ['psg', 2], ['om ', 2],
    // Parcs & voyages loisirs
    ['disneyland', 3], ['parc asterix', 3], ['futuroscope', 3], ['puy du fou', 3],
    ['airbnb', 3], ['booking', 3], ['hotels.com', 3], ['accor', 2],
    // High tech
    ['boulanger', 3], ['darty', 3], ['fnac', 3], ['apple store', 3], ['samsung', 2],
    ['amazon', 2], ['cdiscount', 2],
  ],

  'Santé': [
    ['pharmacie', 3], ['medecin', 2], ['docteur', 2], ['doctolib', 3],
    ['hopital', 3], ['clinique', 3], ['chu ', 3], ['chru', 3],
    ['dentiste', 3], ['chirurgien dentiste', 3], ['orthodontiste', 3],
    ['opticien', 3], ['optique', 3], ['afflelou', 3], ['krys', 3], ['atol', 3],
    ['mutuelle', 3], ['april sante', 3], ['alan ', 3], ['malakoff', 3],
    ['ameli', 3], ['cpam', 3], ['securite sociale', 3],
    ['laboratoire', 3], ['radiologie', 3], ['scanner', 2], ['irm ', 2],
    ['kine', 2], ['kinesitherapeute', 3], ['osteopathe', 3],
    ['sante', 2], ['infirmier', 2],
  ],

  'Impôts': [
    ['dgfip', 3], ['impot', 3], ['tresor public', 3], ['direction generale', 2],
    ['taxe', 2], ['taxe fonciere', 3], ['taxe habitation', 3], ['taxe ticpe', 3],
    ['amendes.gouv', 3], ['amende', 2], ['contravention', 2],
    ['urssaf', 3], ['rsi ', 3], ['contributions sociales', 2],
  ],

  'Épargne': [
    ['lep ', 3], ['livret a', 3], ['livret epargne', 3], ['pea ', 3],
    ['pel ', 3], ['assurance vie', 3], ['per ', 3], ['retraite', 2],
    ['boursobank', 3], ['boursorama', 3], ['fortuneo', 3], ['bforbank', 3],
    ['monabanq', 3], ['nalo', 3], ['yomoni', 3], ['linxea', 3],
    ['virement epargne', 3], ['virement livret', 3],
  ],

  'Revenus': [
    ['salaire', 3], ['paie ', 3], ['paye ', 3], ['remuneration', 3],
    ['virement salaire', 3], ['virement employeur', 3],
    ['caf ', 3], ['apl ', 3], ['allocations', 3], ['prestation', 2],
    ['virement cpam', 3], ['remboursement cpam', 3], ['cpam vir', 3],
    ['dividende', 3], ['pret ', 2], ['bourse', 2], ['indemnite', 2],
    ['prime ', 2], ['bonus', 2],
  ],

  'Virement': [
    ['virement sepa', 3], ['vir sepa', 3], ['vir recu', 3], ['vir emis', 3],
    ['transfert', 2], ['envoi ', 1], ['remboursement', 2], ['entre comptes', 3],
    ['lydia', 3], ['paypal', 2], ['sumeria', 3], ['n26', 3], ['revolut', 3],
    ['wise ', 3], ['payeer', 2],
  ],
};

/**
 * Score a (normalized) description against all category keyword lists.
 * Returns a map: { categoryName: score }
 */
function scoreDescription(norm) {
  const scores = {};

  for (const [cat, pairs] of Object.entries(KEYWORD_WEIGHTS)) {
    let score = 0;
    for (const [kw, weight] of pairs) {
      if (norm.includes(kw)) {
        // Boost if exact word boundary match
        const wordBoundary = new RegExp(`(^|\\s)${kw.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
        score += wordBoundary.test(norm) ? weight * 1.5 : weight;
      }
    }
    if (score > 0) scores[cat] = score;
  }

  return scores;
}

/**
 * Main entry point.
 * Categorize a transaction based on description, amount, and userId.
 */
const categorizeTransaction = async (description, amount, userId) => {
  // ── Layer 1: User-defined rules (exact substring match, highest priority) ──
  const rules = await prisma.categoryRule.findMany({
    where: { OR: [{ userId: null }, { userId: userId || null }] },
    include: { category: true },
    orderBy: [{ userId: 'desc' }, { priority: 'desc' }],
  });

  const descLower = description.toLowerCase();
  for (const rule of rules) {
    if (descLower.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }

  // ── Layer 2: Scored keyword matching on normalized description ─────────────
  const norm = normalizeDesc(description);
  const scores = scoreDescription(norm);

  // Remove Revenus if amount is negative (can't earn money with negative tx)
  if (amount < 0) delete scores['Revenus'];
  // Remove Épargne if amount is positive (credit flow, not savings debit)
  // Actually savings transfers can be credit too, so no hard rule here

  let bestCategory = 'Autres';
  let bestScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  // ── Layer 3: Amount-based heuristics (when no keyword match) ──────────────
  if (bestCategory === 'Autres') {
    if (amount > 0) {
      bestCategory = 'Revenus'; // Positive + uncategorized = likely income
    }
    // Negative remains 'Autres'
  }

  // ── Fetch from DB ──────────────────────────────────────────────────────────
  const category = await prisma.category.findFirst({ where: { name: bestCategory } });
  if (!category) {
    return await prisma.category.findFirst({ where: { name: 'Autres' } });
  }

  return category;
};

module.exports = { categorizeTransaction };
