# Firebase Authentication + Supabase Database Integration

## 🎯 Vue d'Ensemble

Ce projet utilise **Firebase Authentication** pour l'authentification des utilisateurs et **Supabase (PostgreSQL)** comme base de données principale. Cette architecture combine les avantages des deux services :

- ✅ **Firebase Auth** : Authentification robuste avec Google OAuth, email/password, 2FA, etc.
- ✅ **Supabase DB** : Base de données PostgreSQL flexible avec toutes vos données métier
- ✅ **Synchronisation Automatique** : Les utilisateurs Firebase sont automatiquement créés dans Supabase

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
│  (React)    │
└──────┬──────┘
       │
       │ 1. Login avec Firebase Auth
       ▼
┌─────────────────────┐
│  Firebase Auth      │
│  (Authentication)   │
└──────┬──────────────┘
       │
       │ 2. Obtient Firebase ID Token
       ▼
┌─────────────────────┐
│   Express API       │
│  (Backend)          │
└──────┬──────────────┘
       │
       │ 3. Vérifie token avec Firebase Admin SDK
       │ 4. Crée/récupère user dans Supabase
       ▼
┌─────────────────────┐
│  Supabase DB        │
│  (PostgreSQL)       │
└─────────────────────┘
```

## 📋 Flow d'Authentification Détaillé

### 1. Connexion Frontend (Firebase)

```typescript
// client/src/lib/firebase.ts
import { signInWithEmail, signInWithGoogle } from '@/lib/firebase';

// Connexion email/password
const userCredential = await signInWithEmail('user@example.com', 'password');

// Connexion Google
const userCredential = await signInWithGoogle();

// Obtenir le token Firebase
const idToken = await userCredential.user.getIdToken();
```

### 2. Envoi du Token au Backend

```typescript
// client/src/lib/api.ts
const response = await fetch('/api/protected-route', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

### 3. Vérification Backend et Synchronisation

```typescript
// server/middleware/firebase-auth.middleware.ts
export const verifyFirebaseToken = async (req, res, next) => {
  // 1. Extraire le token de l'header Authorization
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  // 2. Vérifier avec Firebase Admin SDK
  const decodedToken = await firebaseAdminService.verifyIdToken(idToken);

  // 3. Créer/récupérer l'utilisateur dans Supabase
  const { user, role } = await getOrCreateSupabaseUser(
    decodedToken.uid,
    decodedToken.email
  );

  // 4. Attacher les infos à la requête
  req.firebaseUser = {
    uid: decodedToken.uid,
    email: decodedToken.email,
    role: role
  };

  next();
};
```

## 🔑 Configuration Firebase Admin SDK

### Étape 1 : Générer une Clé de Compte de Service

1. Allez sur [Firebase Console](https://console.firebase.google.com/project/ecos-orl-1/settings/serviceaccounts/adminsdk)
2. Cliquez sur **"Paramètres du projet"** (icône engrenage)
3. Allez dans l'onglet **"Comptes de service"**
4. Cliquez sur **"Générer une nouvelle clé privée"**
5. Téléchargez le fichier JSON

### Étape 2 : Ajouter les Credentials dans .env

Ouvrez le fichier JSON téléchargé et extrayez les valeurs :

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=ecos-orl-1
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ecos-orl-1.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...votre_clé_ici...==\n-----END PRIVATE KEY-----\n"
```

⚠️ **Important** :
- Gardez les guillemets autour de `FIREBASE_PRIVATE_KEY`
- Gardez les `\n` dans la clé privée
- Ne partagez JAMAIS ce fichier JSON ou ces variables

### Étape 3 : Vérifier la Configuration

```bash
# Redémarrer le serveur
npm run dev

# Vous devriez voir dans les logs :
# ✅ Firebase Admin SDK initialized successfully
```

## 🗄️ Schéma de Base de Données Supabase

### Table `users`

```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,              -- Firebase UID ou UUID
  email VARCHAR UNIQUE,                -- Email de l'utilisateur
  firebase_uid VARCHAR UNIQUE,         -- Firebase UID (pour la synchronisation)
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table `user_roles`

```sql
CREATE TABLE user_roles (
  user_id VARCHAR REFERENCES users(id),
  role VARCHAR NOT NULL,               -- 'admin' ou 'student'
  PRIMARY KEY (user_id, role)
);
```

### Synchronisation Automatique

Le middleware `firebase-auth.middleware.ts` gère automatiquement :

1. **Création de l'utilisateur** : Si c'est la première connexion Firebase, l'utilisateur est créé dans Supabase
2. **Liaison Firebase ↔ Supabase** : Le `firebase_uid` est enregistré pour les connexions futures
3. **Récupération du rôle** : Le rôle est chargé depuis Supabase et attaché à `req.firebaseUser`

## 🛡️ Utilisation des Middlewares

### Protection des Routes

```typescript
// server/routes.ts
import { verifyFirebaseToken, requireFirebaseAdmin } from './middleware/firebase-auth.middleware';

// Route protégée (authentification requise)
app.get('/api/profile', verifyFirebaseToken, (req, res) => {
  res.json({
    uid: req.firebaseUser.uid,
    email: req.firebaseUser.email,
    role: req.firebaseUser.role
  });
});

// Route admin (authentification + rôle admin requis)
app.get('/api/admin/users', verifyFirebaseToken, requireFirebaseAdmin, (req, res) => {
  // Seuls les admins peuvent accéder ici
});
```

### Middlewares Disponibles

1. **`verifyFirebaseToken`** : Vérifie le token Firebase et synchronise avec Supabase
2. **`requireFirebaseAdmin`** : Requiert le rôle admin
3. **`requireFirebaseStudent`** : Requiert le rôle student ou admin
4. **`optionalFirebaseAuth`** : Authentification optionnelle (ne bloque pas si pas de token)

## 🔧 Services Disponibles

### FirebaseAdminService

```typescript
import { firebaseAdminService } from './services/firebase-admin.service';

// Vérifier un token
const decodedToken = await firebaseAdminService.verifyIdToken(idToken);

// Créer un utilisateur
const user = await firebaseAdminService.createUser(email, password);

// Définir des custom claims (rôles)
await firebaseAdminService.setCustomClaims(uid, { role: 'admin' });

// Obtenir un utilisateur
const user = await firebaseAdminService.getUserByEmail(email);
```

### UnifiedDatabaseService

```typescript
import { unifiedDb } from './services/unified-database.service';

// Créer un utilisateur dans Supabase
const user = await unifiedDb.createUser({
  email: 'user@example.com',
  firebaseUid: 'firebase_uid_here'
});

// Obtenir un utilisateur par Firebase UID
const user = await unifiedDb.getUserByFirebaseUid(firebaseUid);

// Définir le rôle d'un utilisateur
await unifiedDb.setUserRole(userId, 'admin');

// Obtenir le rôle d'un utilisateur
const role = await unifiedDb.getUserRole(userId);
```

## 📝 Exemple Complet : Création d'un Compte

### Frontend

```typescript
// pages/signup.tsx
import { signUpWithEmail } from '@/lib/firebase';
import { apiRequest } from '@/lib/queryClient';

async function handleSignup(email: string, password: string) {
  try {
    // 1. Créer le compte Firebase
    const userCredential = await signUpWithEmail(email, password);

    // 2. Obtenir le token
    const idToken = await userCredential.user.getIdToken();

    // 3. Appeler le backend pour créer l'utilisateur dans Supabase
    // (Le middleware le fait automatiquement au premier appel API)
    const response = await fetch('/api/profile', {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    console.log('Compte créé avec succès !');
  } catch (error) {
    console.error('Erreur lors de la création du compte:', error);
  }
}
```

### Backend (Automatique)

Le middleware `verifyFirebaseToken` gère automatiquement la création de l'utilisateur dans Supabase lors du premier appel API.

## 🚀 Migration des Utilisateurs Existants

Si vous avez déjà des utilisateurs dans Supabase sans Firebase UID :

```typescript
// Script de migration (à exécuter une fois)
async function migrateExistingUsers() {
  const users = await unifiedDb.getAllUsers();

  for (const user of users) {
    if (!user.firebase_uid && user.email) {
      try {
        // Créer l'utilisateur dans Firebase
        const firebaseUser = await firebaseAdminService.createUser(
          user.email,
          'temporary_password_123' // L'utilisateur devra le changer
        );

        // Lier le compte Supabase à Firebase
        await unifiedDb.updateUserFirebaseUid(user.id, firebaseUser.uid);

        // Envoyer un email de réinitialisation de mot de passe
        await firebaseAdminService.sendPasswordResetEmail(user.email);

        console.log(`✅ Migré : ${user.email}`);
      } catch (error) {
        console.error(`❌ Erreur pour ${user.email}:`, error);
      }
    }
  }
}
```

## 🔒 Sécurité

### Bonnes Pratiques

1. ✅ **Toujours vérifier le token côté serveur** avec Firebase Admin SDK
2. ✅ **Ne jamais faire confiance aux données client** sans vérification
3. ✅ **Utiliser HTTPS** en production pour protéger les tokens
4. ✅ **Stocker les credentials Firebase Admin** dans des variables d'environnement
5. ✅ **Implémenter la rotation des tokens** (Firebase le fait automatiquement après 1h)
6. ✅ **Activer 2FA** pour les comptes admin

### Restrictions API Firebase

Configurez les restrictions pour votre API key :
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=ecos-orl-1)
- Limitez aux domaines autorisés (localhost, votre domaine de production)

## 🧪 Tests

### Test de l'Authentification

```bash
# 1. Créer un compte via Firebase
curl -X POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=YOUR_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","returnSecureToken":true}'

# 2. Tester avec le token obtenu
curl -X GET http://localhost:5002/api/profile \
  -H "Authorization: Bearer YOUR_ID_TOKEN_HERE"
```

### Test avec les Émulateurs

```bash
# Démarrer les émulateurs Firebase
npm run firebase:emulators

# Utiliser l'Auth Emulator sur http://localhost:9099
```

## 📚 Ressources

- [Documentation Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Documentation Firebase Auth](https://firebase.google.com/docs/auth)
- [Documentation Supabase](https://supabase.com/docs)
- [Middleware firebase-auth.middleware.ts](server/middleware/firebase-auth.middleware.ts)
- [Service firebase-admin.service.ts](server/services/firebase-admin.service.ts)

## ❓ FAQ

### Q: Pourquoi Firebase Auth + Supabase au lieu de Supabase Auth seul ?

**R:** Firebase Auth offre :
- OAuth Google/Facebook/Twitter intégré
- 2FA natif
- Gestion des tokens robuste
- SDK mature et bien documenté
- Interface admin complète

### Q: Les données des utilisateurs sont-elles dupliquées ?

**R:** Non, seules les informations d'authentification sont dans Firebase. Toutes les données métier (sessions ECOS, évaluations, etc.) sont dans Supabase.

### Q: Que se passe-t-il si Firebase est down ?

**R:** Les utilisateurs ne pourront pas se connecter, mais l'application continue de fonctionner pour les sessions déjà authentifiées (jusqu'à expiration du token après 1h).

### Q: Comment gérer les rôles ?

**R:** Les rôles sont stockés dans Supabase (table `user_roles`) et chargés automatiquement par le middleware.

## 🆘 Dépannage

### Erreur : "Firebase Admin SDK not available"

**Solution** : Vérifiez que `firebase-admin` est installé :
```bash
npm install firebase-admin
```

### Erreur : "Invalid or expired Firebase ID token"

**Solutions** :
1. Vérifier que le token est bien envoyé dans l'header `Authorization: Bearer <token>`
2. Vérifier que le token n'a pas expiré (durée de vie : 1h)
3. Regénérer un nouveau token : `await user.getIdToken(true)`

### Erreur : "Missing Firebase Admin SDK credentials"

**Solution** : Vérifier que les 3 variables sont dans `.env` :
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Utilisateur créé dans Firebase mais pas dans Supabase

**Solution** : Vérifier que :
1. Le middleware `verifyFirebaseToken` est bien appelé
2. La connexion Supabase fonctionne
3. Les logs du serveur pour voir les erreurs
