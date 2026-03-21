# Documentation Technique — OpenBank

Application web locale de gestion financière personnelle.  
Architecture : **Frontend React (Vite)** ↔ **Backend Node.js (Express)** ↔ **Base de données SQLite (Prisma)**

---

## Structure du projet

```
OpenBank/
├── backend/                  ← API REST + base de données
│   ├── prisma/
│   │   ├── schema.prisma     ← Définition des tables
│   │   ├── migrations/       ← Historique des migrations SQL
│   │   └── dev.db            ← Fichier SQLite (données réelles)
│   ├── src/
│   │   ├── index.js          ← Point d'entrée Express
│   │   ├── seed.js           ← Données initiales (catégories...)
│   │   ├── config/
│   │   │   └── prisma.js     ← Singleton Prisma Client
│   │   ├── routes/           ← Un fichier par ressource API
│   │   │   ├── accounts.js
│   │   │   ├── analysis.js
│   │   │   ├── auth.js
│   │   │   ├── budgets.js
│   │   │   ├── categories.js
│   │   │   ├── charts.js
│   │   │   ├── dashboard.js
│   │   │   ├── export.js
│   │   │   ├── forecasts.js       ← Prévisions & récurrences (6 endpoints)
│   │   │   ├── import.js
│   │   │   ├── rules.js
│   │   │   ├── transactions.js
│   │   │   └── users.js
│   │   └── services/
│   │       ├── csvParser.js       ← Parser CSV universel multi-banques
│   │       ├── categorizer.js     ← Moteur de catégorisation auto
│   │       ├── recurringDetector.js ← Détection abonnements récurrents
│   │       ├── forecastEngine.js    ← Moteur de prévision fin de mois
│   │       └── transferDetector.js ← Détection virements internes
│   ├── .env                  ← Variables d'environnement
│   └── package.json
│
├── frontend/                 ← Interface utilisateur React
│   ├── index.html            ← Point d'entrée HTML
│   ├── vite.config.js        ← Config Vite
│   ├── src/
│   │   ├── main.jsx          ← Montage React + dark mode init
│   │   ├── App.jsx           ← Router React + routes
│   │   ├── index.css         ← Design system (CSS variables, dark mode)
│   │   ├── api/
│   │   │   └── index.js      ← Client Axios (baseURL, intercepteurs auth)
│   │   ├── store/
│   │   │   └── index.js      ← État global Zustand (user, accounts, theme)
│   │   ├── components/
│   │   │   ├── Layout.jsx    ← Conteneur principal (Sidebar + TopBar + Outlet)
│   │   │   ├── Sidebar.jsx   ← Navigation latérale
│   │   │   ├── TopBar.jsx    ← Barre supérieure (dark mode, profil)
│   │   │   └── Card.jsx      ← Composant carte réutilisable
│   │   └── pages/
│   │       ├── Dashboard.jsx     ← Tableau de bord + widget prévision
│   │       ├── Import.jsx
│   │       ├── Transactions.jsx
│   │       ├── Charts.jsx
│   │       ├── Budget.jsx
│   │       ├── Analysis.jsx      ← Analyse + section récurrences
│   │       ├── Forecasts.jsx     ← Prévisions financières (NEW)
│   │       └── Settings.jsx      ← Paramètres + config prévision
│   └── package.json
│
└── Imports/                  ← Dossier de dépôt des CSV bancaires
```

---

## Démarrage des serveurs

### Prérequis

- **Node.js** v18+ (installé dans `C:\Program Files\nodejs\`)
- Les dépendances déjà installées (`node_modules/` présents)

> ⚠️ Il faut ouvrir **deux terminaux** : un pour le backend, un pour le frontend.

---

### Terminal 1 — Backend (API + Base de données)

```powershell
cd C:\Users\Julien\Documents\OpenBank\backend
npm run dev
```

Le serveur démarre sur **http://localhost:3001**  
Nodemon surveille les fichiers et redémarre automatiquement à chaque modification.

Pour la production (sans rechargement automatique) :
```powershell
npm start
```

**Vérification** : ouvrez http://localhost:3001/api/health → doit retourner `{"status":"ok"}`

---

### Terminal 2 — Frontend (Interface utilisateur)

```powershell
cd C:\Users\Julien\Documents\OpenBank\frontend
npm run dev
```

L'interface est accessible sur **http://localhost:5173**

---

## Base de données

### Technologie

**SQLite** via **Prisma ORM**. La base de données est un simple fichier local :

```
backend/prisma/dev.db
```

Pas de mot de passe, pas de service à démarrer. Ce fichier contient toutes vos données.

---

### Schéma des tables

```
User                  → Utilisateurs (nom, email, rôle ADMIN/READER)
Account               → Comptes bancaires (Courant, Livret A, PEA, Autre)
Transaction           → Toutes les opérations importées
Category              → Catégories de dépenses (Alimentation, Transport...)
CategoryRule          → Règles de catégorisation automatique (mots-clés)
Budget                → Plafonds budgétaires par catégorie et par mois
ImportHistory         → Historique des fichiers importés
RecurringTransaction  → Abonnements/récurrences détectés ou confirmés
ForecastSettings      → Paramètres de prévision par utilisateur
```

#### Relations

```
User ──< Account ──< Transaction >── Category
                                        │
Category ──< CategoryRule              │
Category ──< Budget >── User           │
Account ──< ImportHistory              │
User ──< RecurringTransaction >── Category
User ──< ForecastSettings (1:1)
```

---

### Connexion à la base via `.env`

Fichier : `backend/.env`

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key"
PORT=3001
```

---

### Commandes de base de données

Toutes ces commandes s'exécutent depuis le dossier `backend/`.

| Commande | Description |
|---|---|
| `npm run db:migrate` | Appliquer les migrations (après modification de `schema.prisma`) |
| `npm run db:seed` | Réinsérer les catégories et données initiales |
| `npm run db:reset` | ⚠️ Réinitialiser complètement la BDD (supprime toutes les données) |

#### Accéder à la base directement

Via **Prisma Studio** (interface visuelle web) :
```powershell
cd backend
npx prisma@6.0.0 studio
```
Ceci ouvre http://localhost:5555 avec un explorateur de tables.

---

### Migration vers PostgreSQL (serveur)

Pour passer d'une instance locale à un serveur distant, il suffit de changer une seule ligne dans `.env` :

```env
# Avant (local)
DATABASE_URL="file:./prisma/dev.db"

# Après (serveur distant)
DATABASE_URL="postgresql://user:password@host:5432/openbank"
```

Puis appliquer :
```powershell
npx prisma@6.0.0 migrate deploy
```

---

## Architecture de l'API

### Fonctionnement

```
Frontend (React)
    │  HTTP REST (JSON)
    ▼
Backend Express (port 3001)
    │  CORS autorisé depuis localhost:5173
    │
    ├── /api/auth          → Authentification JWT
    ├── /api/accounts      → CRUD comptes bancaires
    ├── /api/transactions  → Liste + édition catégorie
    ├── /api/import        → Import CSV + détection format
    ├── /api/dashboard     → KPIs temps réel
    ├── /api/charts        → Données graphiques
    ├── /api/budgets       → CRUD budgets
    ├── /api/analysis      → Analyse intelligente
    ├── /api/forecasts     → Prévisions & récurrences
    ├── /api/categories    → Catégories
    ├── /api/rules         → Règles auto-catégorisation
    ├── /api/users         → CRUD utilisateurs
    └── /api/export        → Export CSV enrichi
         │
         ▼
    Prisma ORM
         │
         ▼
    SQLite (dev.db)
```

### Pipeline d'import CSV

Quand un fichier CSV est envoyé à `POST /api/import` :

```
Fichier CSV (buffer)
    │
    ▼  csvParser.js
    ├── 1. Détection encodage (UTF-8 BOM / Latin-1 / UTF-16)
    ├── 2. Détection séparateur (; , \t)
    ├── 3. Détection de l'en-tête réelle (skip des métadonnées bancaires)
    ├── 4. PapaParse (gère les champs multiligne entre guillemets)
    └── 5. Normalisation : date, montant, libellé, type (INCOME/EXPENSE)
    │
    ▼  categorizer.js
    Correspondance mots-clés → catégorie
    │
    ▼  Prisma
    INSERT en BDD (avec vérification doublons)
    │
    ▼  transferDetector.js
    Détection virements internes (même montant entre comptes)
```

---

### Fonctionnalités du 20 Mars 2026

#### Prévisions Financières & Détection d'Abonnements

**Fichiers backend :** `services/recurringDetector.js`, `services/forecastEngine.js`, `routes/forecasts.js`
**Fichiers frontend :** `pages/Forecasts.jsx`
**Modèles Prisma :** `RecurringTransaction`, `ForecastSettings`

**Moteur de détection des récurrences** (`recurringDetector.js`) :
- Regroupe les transactions par description normalisée (réutilise `normalizeDesc` du `categorizer.js`)
- Détecte les patterns temporels : intervalle régulier (~7j hebdo, ~30j mensuel, ~90j trimestriel, ~365j annuel)
- Critères : minimum 2 occurrences, montant similaire (±15%), intervalle régulier (±5 jours)
- Score de confiance (0-100) basé sur la régularité des intervalles et la constance des montants

**Moteur de prévision** (`forecastEngine.js`) :
- Projette le solde en fin de mois : `soldeActuel + revenusAttendus - dépensesRécurrentes - variablesEstimées`
- Supporte un override manuel du salaire (sinon utilise la détection automatique)
- Calcule le potentiel d'épargne = `soldeProjeté - coussinDeSécurité`
- Génère des alertes : solde négatif, pas de revenu détecté, dépassement du coussin

**Routes API** (`/api/forecasts/*` — JWT requis) :

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/recurring` | Liste des récurrences détectées + confirmées |
| `GET` | `/projection` | Prévision du solde fin de mois |
| `PATCH` | `/recurring/:id` | Modifier/désactiver une récurrence |
| `POST` | `/recurring/confirm` | Confirmer une récurrence détectée (la sauvegarder en BDD) |
| `GET` | `/settings` | Récupérer les paramètres de prévision |
| `PATCH` | `/settings` | Mettre à jour les paramètres (salaire, coussin, sensibilité) |

Tous les endpoints acceptent les filtres globaux (`startDate`, `endDate`, `accountIds`).

**Page Prévisions** (`/forecasts`) :
- 4 KPI Cards : Solde Actuel, Solde Projeté, Potentiel d'Épargne, Jours Restants
- Graphique de projection (AreaChart) : courbe réelle + projection pointillée + ligne de référence coussin
- Tableau interactif des abonnements avec onglets Dépenses/Revenus, badges de confiance, boutons confirmer/désactiver
- Breakdown « Ce mois-ci : Encore à venir » (dépenses récurrentes non prélevées)
- Recommandations d'épargne avec calculs concrets

**Intégrations dans les pages existantes :**
- **Dashboard** : Widget « Prévision fin de mois » cliquable (solde projeté + épargne possible)
- **Analyse** : Section « Dépenses Récurrentes » (total mensuel, top 5, lien vers /forecasts)
- **Paramètres** : Carte « Prévisions & Récurrences » avec inputs configurables :
  - Salaire net mensuel (override ou auto-détection)
  - Coussin de sécurité (défaut 200€)
  - Sensibilité de détection (occurrences min, tolérance montant %, tolérance jours)

---

### Fonctionnalités Récentes (Mars 2026)

#### KPIs Interactifs (Tableau de bord)
- Les cartes (Revenus, Dépenses, Épargne Nette) du Dashboard sont cliquables.
- Un clic déclenche la requête `GET /api/transactions` avec les paramètres `type` et `excludeInternal=true`.
- L'Épargne Nette combine les types (INCOME et EXPENSE) tout en excluant les virements internes, sans définir de `type` explicite, renvoyant l'historique complet des flux réels.
- La vue détaillée apparaît sous les KPIs avec un système de pagination dédié.

#### Gestion des Filtres Globaux (Zustand)
- Composant `GlobalFilterBar.jsx` synchronisé avec le store Zustand.
- Les changements de période ou de compte(s) se répercutent instantanément sur les requêtes `/dashboard` et `/transactions`.

#### Initialisation et Ajustement des Soldes
- Ajout de la possibilité de définir un solde actuel lors de l'import (étape 3 optionnelle).
- Ajout d'une fonctionnalité d'ajustement du solde depuis la page "Paramètres".
- Le backend calcule la valeur "source" (`initialBalance`) en soustrayant dynamiquement la somme des transactions existantes au solde visé, garantissant un suivi parfait : `balance = initialBalance + sum(transactions)`.

---

### Fonctionnalités du 11 Mars 2026

#### Identité Visuelle "Clarify" (Design System)

L'application a été entièrement refondue pour adopter le design system **Clarify** :

**Typographie** — `Inter` (titres, KPIs) et `Satoshi` (corps de texte), classes `.title`, `.h2-title`, `.kpi` dans `index.css`.

**Palette de Couleurs** (`frontend/src/index.css`) :
| Variable CSS | Valeur | Rôle |
|---|---|---|
| `--deep-oxygen` | `#1A2B3C` | Couleur principale (fond sombre, texte) |
| `--electric-mint` | `#2DE1C2` | Accent primaire (boutons, actif) |
| `--coral-soft` | `#FF6B6B` | Danger, dépenses |
| `--emerald` | `#27AE60` | Succès, revenus |

**Glassmorphism** : classe `.glass-card` (backdrop-filter blur + transparence) sur les KPIs du Dashboard.

**Responsive** : sidebar → bottom nav bar sur mobile (< 768px). Grilles → colonne unique.

**Mode Sombre** : fond `#0B1521` (dérivé de `--deep-oxygen`). Toutes les couleurs texte utilisent `--text-main` pour s'adapter automatiquement.

---

#### Filtre Global par Type de Compte

**Fichiers :** `store/index.js`, `GlobalFilterBar.jsx`

Sélecteur bidirectionnel Tous / Courant / Épargne / Crédit :
- Cliquer sur un type → sélectionne automatiquement les comptes correspondants.
- Choisir un compte spécifique → active automatiquement la pillule du bon type.
- Le filtre de type et le filtre de compte individuel sont toujours synchronisés.

Mappage des types : `COURANT`, `LIVRET_A / PEA / PEL` (→ Épargne), `CREDIT / LOA` (→ Crédit).

---

#### Système d'Authentification Complet

**Stack :** `bcryptjs` (12 rounds) + JWT (7 jours) + Passport.js Google OAuth 2.0.

**Routes backend** (`/api/auth/*` — public) :
| Méthode | Route | Description |
|---|---|---|
| `POST` | `/register` | Crée un compte (bcrypt) |
| `POST` | `/login` | Connexion email/mdp → JWT |
| `GET` | `/me` | Profil depuis le JWT |
| `POST` | `/change-password` | Vérifie l'ancien mdp, hash le nouveau |
| `PATCH` | `/profile` | Modifier le nom affiché |
| `DELETE` | `/account` | Supprimer le compte |
| `GET` | `/google` | Démarrer OAuth Google |
| `GET` | `/google/callback` | Callback Google → JWT → redirect frontend |

**Sécurité :** toutes les routes `/api/*` sauf `/api/auth/*` requièrent un JWT valide via le middleware `src/middleware/auth.js`. Le 1er utilisateur créé obtient automatiquement le rôle `ADMIN`.

**Frontend :** pages `Login`, `Register`, `Profile`, `AuthCallback`. `PrivateRoute` activé — les utilisateurs non connectés sont redirigés vers `/login`. La sidebar affiche le nom/avatar et un bouton de déconnexion.

**Variables `.env` requises :**
```env
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
FRONTEND_URL=http://localhost:5173
```

**Google Cloud Console :** URI de redirection autorisée → `http://localhost:3001/api/auth/google/callback`

---

## Configuration avancée

### Changer le port du backend

Dans `backend/.env` :
```env
PORT=3002
```

Et mettre à jour le `baseURL` dans `frontend/src/api/index.js` :
```js
baseURL: 'http://localhost:3002/api'
```

Et la config CORS dans `backend/src/index.js` :
```js
app.use(cors({ origin: 'http://localhost:5173' }));
```

### Exposer sur le réseau local

Pour accéder depuis un autre appareil (téléphone, autre PC) :

**Backend** : modifier `backend/src/index.js` pour écouter sur `0.0.0.0` :
```js
app.listen(PORT, '0.0.0.0', () => { ... });
```

**Frontend** :
```powershell
npm run dev -- --host
```
Puis changer `localhost` par l'IP de votre machine dans `frontend/src/api/index.js`.

---

## Déploiement

Pour mettre Clarify en ligne facilement, plusieurs options s'offrent à vous.

### 🐳 Déploiement avec Docker (Recommandé)

Le projet inclut une configuration Docker complète pour lancer l'application en une seule commande.

1. **Pré-requis** : Avoir Docker et Docker Compose installés.
2. **Configuration** : Assurez-vous que le fichier `backend/.env` contient vos clés (JWT, Google).
3. **Lancement** :
   ```bash
   docker-compose up -d --build
   ```
4. **Accès** :
   - Frontend : `http://localhost` (Port 80)
   - Backend API : `http://localhost:3001`

**Architecture Docker** :
- `backend` : Serveur Node.js (Expose 3001)
- `frontend` : Serveur Nginx (Expose 80, gère le proxy vers l'API et le routage React)
- `volume` : Le fichier `dev.db` est persisté sur votre machine hôte.

---

### 🚀 Déploiement Manuel (PaaS comme Railway, Render, Fly.io)

Si vous n'utilisez pas Docker :

1. **Frontend** :
   - Build : `npm run build`
   - Déployez le dossier `dist` sur un service statique (Vercel, Netlify).
   - Configurez l'URL de l'API via la variable d'environnement `VITE_API_URL`.

2. **Backend** :
   - Déployez le dossier `backend` sur un service Node.js.
   - Exécutez `npx prisma migrate deploy` au démarrage.
   - Configurez les variables d'environnement (`DATABASE_URL`, `JWT_SECRET`, etc.).

---

## Maintenance et Sauvegarde

Toutes vos données sont stockées dans `backend/prisma/dev.db`. 
**Important** : Pensez à sauvegarder ce fichier régulièrement. En cas de déploiement Docker, il se trouve dans le dossier `backend/prisma/` de votre projet et est partagé avec le conteneur.

---

## Mise à jour du code

Pour mettre à jour une instance déjà déployée :
1. Récupérez le dernier code (`git pull`).
2. Re-buildez les images : `docker-compose up -d --build`.
3. Les migrations Prisma s'appliquent automatiquement si vous utilisez les Dockerfiles fournis.

---
