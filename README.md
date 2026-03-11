# Clarify 🏦 ✨

*Dernière mise à jour : 11 Mars 2026*

**Clarify** est une application web de gestion financière personnelle "Full-Stack" conçue pour transformer la gestion de vos comptes bancaires en une expérience fluide, sécurisée et visuellement immersive.

---

## 🎨 Design System "Clarify"

L'application utilise une identité visuelle premium pensée pour le confort de lecture et l'impact visuel :

- **Palette Signature** : 
  - `Deep Oxygen` (#1A2B3C) : Fond sombre et profond.
  - `Electric Mint` (#2DE1C2) : Couleur d'accentuation (boutons, états actifs).
  - `Coral Soft` (#FF6B6B) & `Emerald` (#27AE60) : Sémantique pour les dépenses et revenus.
- **Micro-interactions** :
  - **Glassmorphism** : Cartes KPIs avec effets de flou (`backdrop-filter: blur(20px)`) et transparences.
  - **Spline Charts** : Graphiques Recharts utilisant des courbes `monotone` ou `Catmull-Rom` avec remplissage dégradé.
- **Typographie** : Duo de polices Google Fonts/Fontshare : `Inter` (Haute lisibilité des chiffres) et `Satoshi` (Élégance du texte).
- **Responsive** : Passage dynamique d'une Sidebar latérale à une "Bottom Navigation Bar" sur mobile.

---

## 🔐 Système d'Authentification & Sécurité

L'architecture de sécurité est conçue pour être à la fois robuste et simple d'utilisation :

- **Hybrid Auth** : Support de l'authentification classique (Email/Mot de passe haché avec `bcryptjs` 12 rounds) et de **Google OAuth 2.0**.
- **Liaison Intelligente** : Si un utilisateur se connecte avec Google, le système vérifie s'il existe déjà un compte avec cet email pour lier les profils automatiquement.
- **Sécurité JWT** : Utilisation de JSON Web Tokens avec une validité de 7 jours. Un middleware backend (`src/middleware/auth.js`) protège chaque route API.
- **Gestion de Profil** : Page dédiée pour changer son nom, son mot de passe, ou supprimer ses données de façon irréversible.

---

## 🧮 Subtilités Fonctionnelles

Clarify n'est pas qu'un simple tableau de bord, il intègre des logiques métier avancées :

- **Filtres Bidirectionnels** : Le store Zustand synchronise en temps réel les filtres de *Type de compte* (Courant, Épargne, Crédit) et les filtres de *Comptes individuels*. Choisir un type sélectionne automatiquement les comptes associés et vice-versa.
- **Calcul de Solde "Source"** : Lors de l'import, si vous ajustez un solde, le système ne se contente pas d'écraser la valeur ; il calcule dynamiquement le solde initial nécessaire (`initialBalance`) pour que `somme(transactions) + initial = solde visé`.
- **Détection de Transferts** : Algorithme intelligent qui identifie les flux internes (virements entre vos propres comptes) pour les exclure des calculs de revenus/dépenses réels.
- **KPIs Cliquables** : Cliquer sur un indicateur (Revenus, Dépenses) filtre instantanément la liste des transactions pour n'afficher que les éléments contribuant à ce chiffre.

---

## 🛠 Architecture Technique

- **Frontend** : React 18, Vite, Zustand (State), Recharts (Data Viz), Axios (Intercepteurs JWT).
- **Backend** : Node.js, Express, Passport.js (OAuth), JWT.
- **Base de données** : Prisma ORM avec SQLite (persistant localement).
- **Containerisation** : 
  - `Dockerfile (Backend)` : Build multi-étape optimisé.
  - `Dockerfile (Frontend)` : Servi par Nginx avec configuration `try_files` pour les SPAs et `proxy_pass` pour l'API.

---

## 🚀 Déploiement

### 🐳 Docker (Recommandé)
Le moyen le plus simple : `docker-compose up -d --build`. Tout est pré-configuré.

### 🔼 Vercel (Frontend uniquement)
Vercel est excellent pour le **frontend**, mais ne peut pas héberger le **backend** car SQLite et les serveurs Express persistants ne sont pas compatibles avec le modèle "Serverless" de Vercel.

**Configuration requise pour le Frontend (Vercel) :**
- **Variable** : `VITE_API_URL` = URL de votre backend (ex: `https://api.votre-projet.railway.app/api`).
- **Root Directory** : `frontend`.

**Configuration requise pour le Backend (Railway/Render) :**
- **Variable** : `FRONTEND_URL` = URL de votre site Vercel (ex: `https://clarify.vercel.app`).
- **Variable** : `BACKEND_URL` = URL de votre backend (ex: `https://api.votre-projet.railway.app`).
- **Google Cloud Console** : Ajoutez `${BACKEND_URL}/api/auth/google/callback` aux URIs de redirection autorisées.

### 🚂 Railway / Render (Backend)
Pour le backend, utilisez un service qui supporte **Docker** ou **Node.js avec disque persistant**.
- **Railway** : Importez le dossier `backend`, Railway détectera le Dockerfile et vous permettra de monter un volume pour `dev.db`.

---

## 🔧 Troubleshooting Vercel

Si vous avez l'erreur **"Deployment blocked: no git user associated"** :
C'est parce que Vercel ne reconnaît pas l'email du commit comme appartenant à votre compte. Sur le plan Hobby, tout commit doit être identifié.

**Solution :**
1. Allez dans vos **[Paramètres Vercel (Account Settings) > Emails](https://vercel.com/account/emails)**.
2. Ajoutez l'adresse utilisée pour les commits : **`jujuabergel@gmail.com`**.
3. **Vérifiez l'email** via le lien envoyé par Vercel.
4. Une fois l'email vérifié, Vercel pourra associer vos commits à votre compte et le déploiement se débloquera automatiquement au prochain push.

- **"No Build Script Found"** : Assurez-vous d'avoir bien sélectionné le dossier `/frontend` comme "Root Directory" dans Vercel (Settings > General).
- **Erreurs API (404/500)** : Le frontend Vercel doit pouvoir contacter le backend. Vérifiez que `VITE_API_URL` est bien configurée avec l'URL de votre serveur Railway/Render.
- **Routage (404 on refresh)** : Le fichier `vercel.json` à la racine gère déjà la redirection vers `index.html` pour les SPAs.

---

## 📜 Licence & Crédits

Propriété de **Harpeprisme**. Conçu avec une obsession pour la clarté financière.
