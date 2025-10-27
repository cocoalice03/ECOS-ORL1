# Guide de Configuration Vercel - Variables d'Environnement

## 🎯 Objectif

Configurer toutes les variables d'environnement Firebase dans Vercel pour le projet `ecos-orl-1`.

---

## 📋 Liste Complète des Variables à Configurer

### Groupe 1: Variables Client (VITE_* - 7 variables)

Ces variables sont utilisées par le frontend React/Vite.

```env
VITE_FIREBASE_API_KEY=AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I
VITE_FIREBASE_AUTH_DOMAIN=ecos-orl-1.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ecos-orl-1
VITE_FIREBASE_STORAGE_BUCKET=ecos-orl-1.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=357138285313
VITE_FIREBASE_APP_ID=1:357138285313:web:c0724a285e8d58feec9100
VITE_FIREBASE_MEASUREMENT_ID=G-S3F2Z7PZ1Z
```

### Groupe 2: Variables Serveur (FIREBASE_* - 6 variables)

Ces variables sont utilisées par le backend Express.

```env
FIREBASE_PROJECT_ID=ecos-orl-1
FIREBASE_API_KEY=AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I
FIREBASE_AUTH_DOMAIN=ecos-orl-1.firebaseapp.com
FIREBASE_STORAGE_BUCKET=ecos-orl-1.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=357138285313
FIREBASE_APP_ID=1:357138285313:web:c0724a285e8d58feec9100
```

### Groupe 3: Variables Firebase Admin SDK (3 variables) - CRITIQUES

Ces variables sont **ESSENTIELLES** pour le fonctionnement du backend.

```env
FIREBASE_PROJECT_ID=ecos-orl-1

FIREBASE_CLIENT_EMAIL=[À COPIER depuis le JSON téléchargé]

FIREBASE_PRIVATE_KEY=[À COPIER depuis le JSON téléchargé - AVEC GUILLEMETS]
```

**⚠️ IMPORTANT**: Ces valeurs proviennent du fichier JSON que vous avez téléchargé dans la Phase 1.3.

---

## 🔧 Méthode 1: Interface Vercel (Recommandée - Plus Simple)

### Étape 1: Accéder aux Environment Variables

1. Allez sur: https://vercel.com/dave234561s-projects/ecos-orl-1/settings/environment-variables
2. Ou naviguez manuellement:
   - Vercel Dashboard
   - Sélectionner le projet `ecos-orl-1`
   - Cliquer sur **Settings**
   - Cliquer sur **Environment Variables** dans le menu de gauche

### Étape 2: Supprimer les Anciennes Variables (Si Présentes)

Recherchez et **supprimez** toute variable qui contient:
- `ecos-beaujon`
- Anciennes valeurs de `FIREBASE_*` ou `VITE_FIREBASE_*`

### Étape 3: Ajouter Chaque Variable

Pour **chaque** variable de la liste ci-dessus:

1. Cliquer sur **"Add New"** ou **"Add Another"**
2. Remplir le formulaire:
   - **Name**: `VITE_FIREBASE_API_KEY` (par exemple)
   - **Value**: `AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I`
   - **Environments**: ✅ Cocher **Production**, **Preview**, ET **Development**
3. Cliquer sur **"Save"**

**Répéter pour toutes les 16 variables!**

### Variables avec Attention Particulière

#### Pour `FIREBASE_PRIVATE_KEY`:

⚠️ **Format EXACT requis**:

```
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCB...(longue clé)...\n-----END PRIVATE KEY-----\n"
```

**Points critiques**:
- ✅ Guillemets au début et à la fin
- ✅ Tous les `\n` doivent être présents
- ✅ Pas d'espaces avant/après
- ✅ Copier depuis le JSON sans modification

### Étape 4: Vérifier Toutes les Variables

Une fois toutes ajoutées, vous devriez voir **16 variables** au total:

**Client (7)**:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

**Serveur (6)**:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

**Admin SDK (3)**:
- `FIREBASE_PROJECT_ID` (déjà compté ci-dessus)
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

---

## 🔧 Méthode 2: Vercel CLI (Alternative - Plus Rapide Si Vous Êtes à l'Aise avec CLI)

### Prérequis

```bash
# Installer Vercel CLI si ce n'est pas déjà fait
npm install -g vercel

# Se connecter à Vercel
vercel login

# Lier le projet
cd /Users/aircherub/CascadeProjects/ECOS-ORL/ECOS-ORL1
vercel link
```

### Script d'Ajout Automatique

J'ai créé un script qui peut ajouter toutes les variables automatiquement.

**Voir le fichier**: `scripts/setup-vercel-env.sh`

### Utilisation du Script

```bash
# Rendre le script exécutable
chmod +x scripts/setup-vercel-env.sh

# Exécuter le script
./scripts/setup-vercel-env.sh
```

Le script vous demandera:
1. Confirmation du projet
2. Les valeurs de `FIREBASE_CLIENT_EMAIL`
3. Les valeurs de `FIREBASE_PRIVATE_KEY`

---

## 📊 Tableau de Correspondance

| Variable | Source | Exemple de Valeur | Obligatoire |
|----------|--------|-------------------|-------------|
| `VITE_FIREBASE_API_KEY` | `.env` local | `AIzaSyBx7MmV0lx...` | ✅ |
| `VITE_FIREBASE_AUTH_DOMAIN` | `.env` local | `ecos-orl-1.firebaseapp.com` | ✅ |
| `VITE_FIREBASE_PROJECT_ID` | `.env` local | `ecos-orl-1` | ✅ |
| `VITE_FIREBASE_STORAGE_BUCKET` | `.env` local | `ecos-orl-1.firebasestorage.app` | ✅ |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `.env` local | `357138285313` | ✅ |
| `VITE_FIREBASE_APP_ID` | `.env` local | `1:357138285313:web:c0724...` | ✅ |
| `VITE_FIREBASE_MEASUREMENT_ID` | `.env` local | `G-S3F2Z7PZ1Z` | ⚪ Optionnel |
| `FIREBASE_PROJECT_ID` | `.env` local | `ecos-orl-1` | ✅ |
| `FIREBASE_API_KEY` | `.env` local | `AIzaSyBx7MmV0lx...` | ✅ |
| `FIREBASE_AUTH_DOMAIN` | `.env` local | `ecos-orl-1.firebaseapp.com` | ✅ |
| `FIREBASE_STORAGE_BUCKET` | `.env` local | `ecos-orl-1.firebasestorage.app` | ✅ |
| `FIREBASE_MESSAGING_SENDER_ID` | `.env` local | `357138285313` | ✅ |
| `FIREBASE_APP_ID` | `.env` local | `1:357138285313:web:c0724...` | ✅ |
| `FIREBASE_CLIENT_EMAIL` | JSON téléchargé | `firebase-adminsdk-xxxxx@...` | ✅✅✅ |
| `FIREBASE_PRIVATE_KEY` | JSON téléchargé | `"-----BEGIN PRIVATE KEY...` | ✅✅✅ |

---

## ✅ Checklist de Validation

Avant de passer au redéploiement:

### Variables Configurées
- [ ] 7 variables `VITE_FIREBASE_*` ajoutées
- [ ] 6 variables `FIREBASE_*` (backend) ajoutées
- [ ] `FIREBASE_CLIENT_EMAIL` ajoutée
- [ ] `FIREBASE_PRIVATE_KEY` ajoutée (format correct avec guillemets)

### Environnements
- [ ] Toutes les variables sont disponibles pour **Production**
- [ ] Toutes les variables sont disponibles pour **Preview**
- [ ] Toutes les variables sont disponibles pour **Development**

### Anciennes Variables
- [ ] Aucune variable pointant vers `ecos-beaujon` ne reste
- [ ] Aucune variable avec API Key `AIzaSyA0S8z0u6I...` ne reste

### Format `FIREBASE_PRIVATE_KEY`
- [ ] Commence par un guillemet `"`
- [ ] Contient `-----BEGIN PRIVATE KEY-----\n`
- [ ] Contient des `\n` au milieu de la clé
- [ ] Se termine par `\n-----END PRIVATE KEY-----\n"`
- [ ] Se termine par un guillemet `"`

---

## 🆘 Dépannage

### Erreur: "Variable already exists"

**Cause**: Une variable avec ce nom existe déjà

**Solution**:
1. Trouvez la variable existante dans la liste
2. Cliquez sur les trois points `...` à droite
3. Sélectionnez **"Edit"**
4. Mettez à jour la valeur
5. **Vérifiez que tous les environnements sont cochés**
6. Sauvegardez

### Erreur: Format Invalide pour FIREBASE_PRIVATE_KEY

**Symptômes**: L'authentification échoue avec "Invalid private key"

**Solution**:
1. Ouvrez à nouveau le fichier JSON téléchargé
2. Copiez la valeur de `private_key` **exactement comme elle est**
3. Assurez-vous qu'elle inclut:
   - Les guillemets au début et à la fin
   - Tous les `\n` (pas de vraies nouvelles lignes)
4. Collez dans Vercel sans modification

### Variables Non Visibles dans l'Application

**Cause**: Variables ajoutées après le dernier déploiement

**Solution**: Redéployer l'application (Phase 3.1)

---

## 🔒 Sécurité

### Variables Sensibles

Ces variables sont **SENSIBLES** et ne doivent JAMAIS être partagées:
- `FIREBASE_PRIVATE_KEY` ⚠️⚠️⚠️
- `FIREBASE_CLIENT_EMAIL` ⚠️
- Service Account JSON file ⚠️⚠️⚠️

### Variables Publiques (Sûres)

Ces variables sont **PUBLIQUES** et peuvent être exposées côté client:
- Toutes les variables `VITE_FIREBASE_*`
- `FIREBASE_API_KEY`
- `FIREBASE_PROJECT_ID`

**Pourquoi?** Firebase sécurise via:
1. Security Rules
2. Domaines autorisés
3. App Check (optionnel)

Pas via le secret de l'API key!

---

## ➡️ Prochaine Étape

Une fois toutes les variables configurées et vérifiées:

**Passer à Phase 3: Redéploiement**

Le redéploiement est **OBLIGATOIRE** pour que les nouvelles variables prennent effet!
