# 🚀 Guide Pas à Pas : Déployer les Règles Firebase

## 📋 Ce que vous allez faire

Vous allez copier-coller les règles de sécurité dans la console Firebase. C'est simple et rapide (5-10 minutes).

---

## 🔥 PARTIE 1 : Déployer les Règles FIRESTORE

### Étape 1 : Ouvrir la Console Firestore Rules

1. **Ouvrez ce lien dans votre navigateur** :
   ```
   https://console.firebase.google.com/project/ecos-orl-1/firestore/rules
   ```

2. **Connectez-vous** avec votre compte Google (celui qui a accès au projet Firebase)

3. Vous devriez voir une page avec un **éditeur de code** au centre

### Étape 2 : Copier les Règles Firestore

**COPIEZ TOUT LE CODE CI-DESSOUS** (du début à la fin) :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() &&
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users collection - users can read/write their own data, admins can read all
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId) || isAdmin();
    }

    // Scenarios collection - authenticated users can read, only admins can write
    match /scenarios/{scenarioId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Sessions collection - users can read/write their own sessions
    match /sessions/{sessionId} {
      allow read: if isAuthenticated() &&
                     (resource.data.studentEmail == request.auth.token.email || isAdmin());
      allow create: if isAuthenticated() &&
                       request.resource.data.studentEmail == request.auth.token.email;
      allow update: if isAuthenticated() &&
                       (resource.data.studentEmail == request.auth.token.email || isAdmin());
      allow delete: if isAdmin();
    }

    // Exchanges (messages) collection - users can read/write their own exchanges
    match /exchanges/{exchangeId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Evaluations collection - users can read their own evaluations, admins can read all
    match /evaluations/{evaluationId} {
      allow read: if isAuthenticated() &&
                     (resource.data.studentEmail == request.auth.token.email || isAdmin());
      allow write: if isAuthenticated();
    }

    // Training sessions collection - authenticated users can read, admins can write
    match /training_sessions/{sessionId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Default deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Étape 3 : Coller dans l'Éditeur Firebase

1. **Sélectionnez TOUT le texte** dans l'éditeur Firebase (Ctrl+A ou Cmd+A)
2. **Supprimez** le contenu actuel (touche Suppr ou Backspace)
3. **Collez** les règles que vous avez copiées (Ctrl+V ou Cmd+V)

### Étape 4 : Publier les Règles Firestore

1. Cliquez sur le bouton **"Publier"** (en haut à droite)
2. Attendez la confirmation : "Règles publiées avec succès" ✅
3. Notez l'heure de publication affichée

---

## 📦 PARTIE 2 : Déployer les Règles STORAGE

### Étape 1 : Ouvrir la Console Storage Rules

1. **Ouvrez ce lien dans votre navigateur** :
   ```
   https://console.firebase.google.com/project/ecos-orl-1/storage/rules
   ```

2. Si la page demande d'activer Storage, cliquez sur **"Activer"** (c'est gratuit)

3. Allez dans l'onglet **"Règles"** (Rules)

### Étape 2 : Copier les Règles Storage

**COPIEZ TOUT LE CODE CI-DESSOUS** :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // User profile images - users can upload their own
    match /users/{userId}/profile/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && isOwner(userId);
    }

    // Scenario resources (images, PDFs) - read by all authenticated, write by admins
    match /scenarios/{scenarioId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() &&
                      request.auth.token.email.matches('.*@admin\\.com$');
    }

    // Session recordings or attachments - users can access their own
    match /sessions/{sessionId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Default deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Étape 3 : Coller dans l'Éditeur Firebase

1. **Sélectionnez TOUT le texte** dans l'éditeur (Ctrl+A ou Cmd+A)
2. **Supprimez** le contenu actuel
3. **Collez** les règles Storage (Ctrl+V ou Cmd+V)

### Étape 4 : Publier les Règles Storage

1. Cliquez sur **"Publier"** (en haut à droite)
2. Attendez la confirmation ✅
3. Notez l'heure de publication

---

## ✅ PARTIE 3 : Vérification

### Vérifier Firestore Rules

1. Retournez sur : https://console.firebase.google.com/project/ecos-orl-1/firestore/rules
2. Vérifiez que vous voyez vos nouvelles règles
3. Vérifiez la **date de publication** en haut (doit être récente)

### Vérifier Storage Rules

1. Allez sur : https://console.firebase.google.com/project/ecos-orl-1/storage/rules
2. Vérifiez que vous voyez vos nouvelles règles
3. Vérifiez la **date de publication**

---

## 🎉 C'est Terminé !

Vos règles de sécurité sont maintenant actives ! Voici ce qui est protégé :

### 🔒 Firestore (Base de données)
- ✅ Seuls les utilisateurs authentifiés peuvent lire/écrire
- ✅ Les utilisateurs ne peuvent accéder qu'à leurs propres données
- ✅ Les admins ont des permissions étendues
- ✅ Les collections sont protégées par rôle

### 📦 Storage (Fichiers)
- ✅ Seuls les utilisateurs authentifiés peuvent accéder aux fichiers
- ✅ Les utilisateurs peuvent uploader leurs photos de profil
- ✅ Les fichiers de session sont privés
- ✅ Les ressources de scénarios sont en lecture seule

---

## 🧪 Tester les Règles

### Test Simple

Retournez dans votre application et :

1. Essayez de vous connecter
2. Essayez d'accéder à vos données
3. Vérifiez qu'il n'y a pas d'erreurs dans la console du navigateur (F12)

### Test Avancé avec le Simulateur

1. Allez sur : https://console.firebase.google.com/project/ecos-orl-1/firestore/rules
2. Cliquez sur **"Simulateur de règles"** (en haut)
3. Testez différents scénarios :
   - Utilisateur non authentifié → devrait être refusé
   - Utilisateur authentifié → devrait avoir accès

---

## 🆘 En Cas de Problème

### Erreur : "Permission denied"

**Cause** : Les règles bloquent l'accès (c'est normal si pas authentifié)

**Solution** :
1. Vérifiez que l'utilisateur est bien connecté avec Firebase Auth
2. Vérifiez que le token Firebase est envoyé dans les requêtes
3. Consultez les logs dans : https://console.firebase.google.com/project/ecos-orl-1/firestore/usage

### Erreur : "Syntax error in rules"

**Cause** : Erreur de copier-coller

**Solution** :
1. Retournez dans l'éditeur de règles
2. Vérifiez qu'il n'y a pas de caractères étranges
3. Recopiez à nouveau depuis ce guide

### Les règles ne s'appliquent pas

**Cause** : Propagation prend quelques minutes

**Solution** :
1. Attendez 2-3 minutes
2. Rafraîchissez votre application (Ctrl+R ou Cmd+R)
3. Videz le cache du navigateur si besoin

---

## 📞 Support

Si vous avez des problèmes :

1. **Vérifiez les logs Firebase** :
   - https://console.firebase.google.com/project/ecos-orl-1/firestore/usage
   - https://console.firebase.google.com/project/ecos-orl-1/storage/usage

2. **Consultez la documentation locale** :
   - Voir `FIREBASE_SETUP.md` pour plus de détails
   - Voir `FIREBASE_SUPABASE_INTEGRATION.md` pour l'authentification

3. **Testez avec les émulateurs** :
   ```bash
   npm run firebase:emulators
   ```

---

## 🎯 Récapitulatif des Liens Importants

| Service | Lien Direct |
|---------|-------------|
| **Firestore Rules** | https://console.firebase.google.com/project/ecos-orl-1/firestore/rules |
| **Storage Rules** | https://console.firebase.google.com/project/ecos-orl-1/storage/rules |
| **Authentication** | https://console.firebase.google.com/project/ecos-orl-1/authentication/users |
| **Project Settings** | https://console.firebase.google.com/project/ecos-orl-1/settings/general |
| **Usage & Logs** | https://console.firebase.google.com/project/ecos-orl-1/firestore/usage |

---

## ✨ Prochaines Étapes

Maintenant que vos règles sont déployées, vous pouvez :

1. **Configurer Firebase Admin SDK** :
   - Voir `FIREBASE_SUPABASE_INTEGRATION.md`
   - Télécharger la clé de service
   - Ajouter les credentials dans `.env`

2. **Restreindre votre API Key** :
   - https://console.cloud.google.com/apis/credentials?project=ecos-orl-1
   - Ajouter des restrictions de domaine

3. **Activer App Check** (optionnel mais recommandé) :
   - https://console.firebase.google.com/project/ecos-orl-1/appcheck

Bravo ! 🎉 Vos données Firebase sont maintenant sécurisées !
