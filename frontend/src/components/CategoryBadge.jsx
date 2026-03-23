/**
 * CategoryBadge — Reusable category pill with Lucide icon
 * =========================================================
 * Used throughout the app (Transactions, Dashboard, Analysis, Categories)
 * to display a category with its icon and color in a consistent style.
 *
 * Props:
 *  - category: { name, color, icon } | null
 *  - size: 'sm' | 'md' (default: 'sm')
 *  - showIcon: boolean (default: true)
 */

import React from 'react';
import {
  ShoppingCart, Home, Car, HeartPulse, GraduationCap, Plane,
  Utensils, Tv, Shirt, Dumbbell, Gamepad2, Music, Baby,
  PiggyBank, Gift, Zap, Wifi, Phone, Building2, CreditCard,
  ArrowRightLeft, TrendingUp, Briefcase, Coffee, Package,
  HelpCircle, Tag,
} from 'lucide-react';

// ── Icon mapping by category name keywords ────────────────────────────────────
const ICON_MAP = [
  // Alimentation
  { keywords: ['alimentat', 'courses', 'supermarché', 'epicerie', 'marché'],      Icon: ShoppingCart },
  // Restaurants / Cafés
  { keywords: ['restaurant', 'café', 'cafe', 'bar ', 'boulangerie', 'fast'],     Icon: Utensils },
  // Logement
  { keywords: ['logement', 'loyer', 'habitation', 'immobilier', 'locat'],        Icon: Home },
  // Transport
  { keywords: ['transport', 'voiture', 'carburant', 'essence', 'station',
               'parking', 'péage', 'train', 'metro', 'transport', 'uber',
               'autoroute', 'covoiturage'],                                       Icon: Car },
  // Santé
  { keywords: ['santé', 'sante', 'médecin', 'medecin', 'pharmacie', 'mutuelle',
               'médical', 'health', 'docteur', 'hopital', 'ordonnance'],         Icon: HeartPulse },
  // Education
  { keywords: ['éducation', 'education', 'école', 'ecole', 'université',
               'formation', 'cours ', 'scolarité', 'livre'],                     Icon: GraduationCap },
  // Voyages
  { keywords: ['voyage', 'vacances', 'hôtel', 'hotel', 'airbnb', 'avion',
               'vol ', 'séjour', 'tourisme'],                                    Icon: Plane },
  // Abonnements / Streaming
  { keywords: ['abonnement', 'streaming', 'netflix', 'spotify', 'disney',
               'amazon prime', 'canal', 'apple tv', 'deezer'],                   Icon: Tv },
  // Téléphone / Telco
  { keywords: ['téléphone', 'telephone', 'mobile', 'sfr', 'orange', 'free',
               'bouygues', 'forfait'],                                            Icon: Phone },
  // Internet / Box
  { keywords: ['internet', 'fibre', 'box', 'wifi', 'adsl'],                     Icon: Wifi },
  // Énergie
  { keywords: ['énergie', 'energie', 'electricité', 'electricite', 'edf',
               'engie', 'gaz', 'water', 'eau'],                                  Icon: Zap },
  // Vêtements
  { keywords: ['vêtements', 'vetements', 'mode', 'zara', 'h&m', 'decathlon',
               'habillement', 'chaussures'],                                     Icon: Shirt },
  // Sport
  { keywords: ['sport', 'fitness', 'salle', 'gym', 'piscine', 'tennis'],       Icon: Dumbbell },
  // Loisirs / Jeux
  { keywords: ['loisirs', 'jeux', 'gaming', 'jeu', 'cinema', 'ugc'],           Icon: Gamepad2 },
  // Musique / Culture
  { keywords: ['musique', 'culture', 'concert', 'théâtre', 'theatre', 'art'], Icon: Music },
  // Enfants
  { keywords: ['enfant', 'bébé', 'bebe', 'jouet', 'crèche', 'creche'],        Icon: Baby },
  // Épargne
  { keywords: ['épargne', 'epargne', 'livret', 'pea', 'cto', 'assurance vie'], Icon: PiggyBank },
  // Cadeaux
  { keywords: ['cadeau', 'don ', 'donation', 'charité'],                        Icon: Gift },
  // Banque / Frais
  { keywords: ['frais', 'banque', 'commission', 'cotisation', 'agios'],         Icon: CreditCard },
  // Investissement
  { keywords: ['investissement', 'bourse', 'actions', 'dividende'],             Icon: TrendingUp },
  // Salaire / Revenus
  { keywords: ['salaire', 'revenu', 'paie', 'revenus', 'rémunération'],        Icon: Briefcase },
  // Virement
  { keywords: ['virement', 'transfer', 'remboursement'],                         Icon: ArrowRightLeft },
  // Café / Snack
  { keywords: ['café', 'cafe', 'snack', 'snacking', 'coffee'],                 Icon: Coffee },
  // Divers
  { keywords: ['divers', 'autre', 'miscellaneous', 'other'],                    Icon: Package },
  // Immeuble / Charges
  { keywords: ['charges', 'syndic', 'copropriété'],                             Icon: Building2 },
];

// Default icon when nothing matches
const DEFAULT_ICON = Tag;

/**
 * Find the appropriate Lucide icon for a category name.
 */
function getIconForCategory(name = '') {
  const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const { keywords, Icon } of ICON_MAP) {
    if (keywords.some(kw => lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
      return Icon;
    }
  }
  return DEFAULT_ICON;
}

/**
 * CategoryBadge component.
 */
export default function CategoryBadge({ category, size = 'sm', showIcon = true, className = '' }) {
  if (!category) {
    return (
      <span className={`category-badge category-badge--empty ${className}`}
        style={{ '--cat-color': 'var(--text-muted)', '--cat-bg': 'var(--bg-app)' }}>
        {showIcon && <Tag size={size === 'md' ? 14 : 12} strokeWidth={1.8} />}
        <span>Non catégorisé</span>
      </span>
    );
  }

  const Icon = getIconForCategory(category.name);
  const color = category.color || '#6B7280';
  const bg = `${color}18`; // 10% opacity

  return (
    <span
      className={`category-badge ${size === 'md' ? 'category-badge--md' : ''} ${className}`}
      style={{ '--cat-color': color, '--cat-bg': bg }}
      title={category.name}
    >
      {showIcon && <Icon size={size === 'md' ? 14 : 12} strokeWidth={2} />}
      <span>{category.name}</span>
    </span>
  );
}
