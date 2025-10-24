# Configuration Firebase - Guide de Déploiement

## 📋 Fichiers de Configuration

Ce projet contient les fichiers de configuration Firebase suivants :

- `firestore.rules` - Règles de sécurité Firestore
- `storage.rules` - Règles de sécurité Storage
- `firebase.json` - Configuration principale Firebase
- `firestore.indexes.json` - Index Firestore
- `.firebaserc` - Configuration du projet Firebase

## 🔐 Règles de Sécurité Configurées

### Firestore Rules

Les règles de sécurité Firestore protègent vos données avec les permissions suivantes :

1. **Users** : Les utilisateurs peuvent lire tous les profils, mais ne peuvent modifier que le leur
2. **Scenarios** : Lecture pour tous les utilisateurs authentifiés, écriture réservée aux admins
3. **Sessions** : Les utilisateurs peuvent lire/écrire leurs propres sessions
4. **Exchanges** : Les messages sont accessibles en lecture/écriture pour les utilisateurs authentifiés
5. **Evaluations** : Les utilisateurs peuvent lire leurs propres évaluations
6. **Training Sessions** : Lecture pour tous, écriture pour les admins

### Storage Rules

Les règles Storage protègent vos fichiers :

1. **Profile Images** : Les utilisateurs peuvent gérer leurs propres photos de profil
2. **Scenario Resources** : Lecture pour tous, écriture pour les admins
3. **Session Files** : Les utilisateurs peuvent gérer les fichiers de leurs sessions

## 🚀 Déploiement des Règles

### Méthode 1 : Via npm scripts (Recommandé)

```bash
# Déployer uniquement les règles de sécurité
npm run firebase:deploy:rules

# Déployer tout (rules + hosting + indexes)
npm run firebase:deploy:all
```

### Méthode 2 : Via Firebase CLI directement

```bash
# Se connecter à Firebase (première fois seulement)
firebase login

# Déployer les règles Firestore et Storage
firebase deploy --only firestore:rules,storage:rules

# Déployer tout
firebase deploy
```

### Méthode 3 : Via la Console Firebase (Interface Web)

1. Allez sur [Firebase Console](https://console.firebase.google.com/project/ecos-orl-1)
2. Cliquez sur **Firestore Database** dans le menu latéral
3. Allez dans l'onglet **Règles**
4. Copiez le contenu de `firestore.rules` et collez-le dans l'éditeur
5. Cliquez sur **Publier**

Répétez pour **Storage** :
1. Cliquez sur **Storage** dans le menu latéral
2. Allez dans l'onglet **Règles**
3. Copiez le contenu de `storage.rules`
4. Cliquez sur **Publier**

## 🧪 Test des Règles en Local

### Utiliser les Émulateurs Firebase

```bash
# Démarrer les émulateurs (Firestore, Storage, Auth)
npm run firebase:emulators

# Ou directement
firebase emulators:start
```

L'interface UI des émulateurs sera disponible sur : `http://localhost:4000`

### Ports des Émulateurs

- **Auth** : http://localhost:9099
- **Firestore** : http://localhost:8080
- **Storage** : http://localhost:9199
- **UI** : http://localhost:4000

## ✅ Vérification du Déploiement

Après avoir déployé les règles, vérifiez dans la console Firebase :

1. **Firestore** :
   - Console > Firestore Database > Règles
   - Vérifiez la date de publication

2. **Storage** :
   - Console > Storage > Règles
   - Vérifiez la date de publication

## 🔧 Modifications des Règles

### Workflow Recommandé

1. Modifier les fichiers `firestore.rules` ou `storage.rules` localement
2. Tester avec les émulateurs : `npm run firebase:emulators`
3. Déployer : `npm run firebase:deploy:rules`
4. Vérifier dans la console Firebase

### Exemple de Modification

Pour ajouter une nouvelle collection protégée :

```javascript
// Dans firestore.rules
match /ma_nouvelle_collection/{docId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}
```

## 🔒 Sécurité

### Règles Importantes

- ❌ **Jamais** utiliser `allow read, write: if true;` en production
- ✅ **Toujours** vérifier l'authentification avec `request.auth != null`
- ✅ **Toujours** valider les permissions avec des fonctions helper
- ✅ **Toujours** tester les règles avec les émulateurs avant déploiement

### Fonctions Helper Disponibles

```javascript
// Vérifie si l'utilisateur est authentifié
isAuthenticated()

// Vérifie si l'utilisateur est propriétaire
isOwner(userId)

// Vérifie si l'utilisateur est admin
isAdmin()
```

## 📝 Commandes Utiles

```bash
# Voir le statut de la connexion Firebase
firebase login:list

# Se connecter à Firebase
firebase login

# Se déconnecter
firebase logout

# Lister les projets Firebase
firebase projects:list

# Sélectionner un projet
firebase use ecos-orl-1

# Voir la configuration actuelle
firebase use
```

## 🆘 Résolution de Problèmes

### Erreur : "Firebase CLI not found"

```bash
npm install -g firebase-tools
```

### Erreur : "Permission denied"

```bash
firebase login
```

### Erreur : "Project not found"

Vérifiez que le fichier `.firebaserc` contient le bon projet ID :

```json
{
  "projects": {
    "default": "ecos-orl-1"
  }
}
```

### Règles non appliquées immédiatement

Les règles peuvent prendre quelques minutes pour se propager. Attendez 2-3 minutes et rafraîchissez votre application.

## 📚 Ressources

- [Documentation Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Guide Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Guide Storage Security Rules](https://firebase.google.com/docs/storage/security/start)
- [Simulateur de règles](https://firebase.google.com/docs/rules/simulator)
