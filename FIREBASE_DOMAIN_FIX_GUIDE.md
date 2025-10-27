# 🔥 Guide de Correction : Domaines Firebase Non Autorisés

**Problème Identifié** : Vos domaines Vercel ne sont PAS autorisés dans votre projet Firebase actuel

## 🔍 Diagnostic du Problème

### Configuration Actuelle (Incorrecte)

**Votre code utilise** : Projet Firebase `ecos-orl-1`
- Project Number: `357138285313`
- Auth Domain: `ecos-orl-1.firebaseapp.com`

**Mais les domaines autorisés sont dans** : Projet `117971094609` (`ecos-beaujon`)
```json
{
  "projectId": "117971094609",
  "authorizedDomains": [
    "localhost",
    "ecos-beaujon.firebaseapp.com",
    "ecos-beaujon.web.app",
    "ecos-infirmier-b-20.vercel.app"  // ❌ Ancien domaine
  ]
}
```

**Votre domaine Vercel actuel** : `ecos-orl-1.vercel.app` ❌ **NON AUTORISÉ**

### Pourquoi l'Authentification Échoue

Quand un utilisateur essaie de se connecter avec Google OAuth depuis `ecos-orl-1.vercel.app` :

1. Firebase vérifie si le domaine est autorisé
2. Trouve que `ecos-orl-1.vercel.app` n'est PAS dans la liste
3. **Bloque la connexion** avec une erreur `auth/unauthorized-domain`

## ✅ Solution Recommandée : Ajouter le Domaine Vercel

### Option A : Utiliser le Projet `ecos-orl-1` (Recommandé)

C'est le projet configuré dans votre `.env`, donc il suffit d'ajouter les bons domaines.

#### Étape 1 : Aller dans Firebase Console

```
https://console.firebase.google.com/project/ecos-orl-1/authentication/settings
```

#### Étape 2 : Ajouter les Domaines Autorisés

Dans la section **"Authorized domains"**, cliquez sur **"Add domain"** et ajoutez :

1. `ecos-orl-1.vercel.app` ✅ (production)
2. `ecos-orl-1-dave234561s-projects.vercel.app` ✅ (preview deployments)
3. `localhost` ✅ (devrait déjà être là)

**Après ajout, la liste devrait ressembler à** :
```json
{
  "projectId": "ecos-orl-1",
  "authorizedDomains": [
    "localhost",
    "ecos-orl-1.firebaseapp.com",
    "ecos-orl-1.web.app",
    "ecos-orl-1.vercel.app",
    "ecos-orl-1-dave234561s-projects.vercel.app"
  ]
}
```

#### Étape 3 : Vérifier la Configuration

Pas besoin de changer le code - votre `.env` est déjà correct :

```env
# ✅ Déjà configuré correctement
VITE_FIREBASE_API_KEY=AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I
VITE_FIREBASE_AUTH_DOMAIN=ecos-orl-1.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ecos-orl-1
```

#### Étape 4 : Redéployer sur Vercel (si nécessaire)

Les variables d'environnement sont déjà bonnes, mais vérifiez qu'elles sont bien dans Vercel :

```bash
# Vérifier les variables Vercel
vercel env ls

# Si manquantes, les ajouter
vercel env add VITE_FIREBASE_API_KEY
vercel env add VITE_FIREBASE_AUTH_DOMAIN
vercel env add VITE_FIREBASE_PROJECT_ID
# ... etc
```

### Option B : Utiliser l'Ancien Projet `ecos-beaujon`

Si vous préférez utiliser le projet où les domaines sont déjà configurés, il faut changer votre `.env`.

⚠️ **Attention** : Cela nécessite d'obtenir les nouvelles credentials Firebase.

#### Étape 1 : Obtenir les Credentials `ecos-beaujon`

```
https://console.firebase.google.com/project/ecos-beaujon/settings/general
```

Copiez les valeurs de configuration.

#### Étape 2 : Mettre à Jour `.env`

```env
# Remplacer toutes les valeurs ecos-orl-1 par ecos-beaujon
VITE_FIREBASE_API_KEY=<nouvelle_api_key>
VITE_FIREBASE_AUTH_DOMAIN=ecos-beaujon.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ecos-beaujon
VITE_FIREBASE_STORAGE_BUCKET=ecos-beaujon.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<nouveau_sender_id>
VITE_FIREBASE_APP_ID=<nouveau_app_id>
VITE_FIREBASE_MEASUREMENT_ID=<nouveau_measurement_id>
```

#### Étape 3 : Ajouter le Nouveau Domaine Vercel

Même si vous utilisez `ecos-beaujon`, il faut ajouter `ecos-orl-1.vercel.app` :

```
https://console.firebase.google.com/project/ecos-beaujon/authentication/settings
```

Ajouter : `ecos-orl-1.vercel.app`

## 🎯 Recommandation : Utiliser Option A

**Pourquoi ?**
- ✅ Votre code est déjà configuré pour `ecos-orl-1`
- ✅ Pas besoin de changer les credentials
- ✅ Projet dédié pour cette application
- ✅ Plus simple et plus propre

**Il suffit juste d'ajouter les domaines Vercel dans la console Firebase !**

## 📋 Actions Immédiates (5 minutes)

### 1. Ouvrir Firebase Console

```
https://console.firebase.google.com/project/ecos-orl-1/authentication/settings
```

### 2. Scroller vers "Authorized domains"

Vous verrez la liste actuelle :
- localhost
- ecos-orl-1.firebaseapp.com
- ecos-orl-1.web.app

### 3. Cliquer "Add domain"

Ajouter un par un :
1. `ecos-orl-1.vercel.app`
2. `ecos-orl-1-dave234561s-projects.vercel.app`

### 4. Sauvegarder

Cliquez sur "Add" pour chaque domaine.

### 5. Attendre la Propagation

Attendre 1-2 minutes pour que les changements se propagent.

### 6. Tester l'Authentification

```bash
# Déployer sur Vercel
vercel --prod

# Ou tester localement
npm run dev
```

Ouvrir votre application et tester la connexion Google OAuth.

## 🧪 Vérification de la Configuration

### Vérifier que les Domaines sont Autorisés

```bash
# Récupérer la configuration Firebase
curl "https://identitytoolkit.googleapis.com/v1/projects/ecos-orl-1/config?key=AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I"
```

Cherchez dans la réponse JSON :
```json
{
  "authorizedDomains": [
    "localhost",
    "ecos-orl-1.firebaseapp.com",
    "ecos-orl-1.web.app",
    "ecos-orl-1.vercel.app",  // ✅ Doit être présent
    "ecos-orl-1-dave234561s-projects.vercel.app"  // ✅ Doit être présent
  ]
}
```

### Vérifier le Projet dans le Code

```bash
# Vérifier quel projet est utilisé
grep "FIREBASE_PROJECT_ID" .env
# Devrait afficher : FIREBASE_PROJECT_ID=ecos-orl-1
```

### Tester l'Authentification Google

1. Ouvrir `https://ecos-orl-1.vercel.app`
2. Cliquer sur "Se connecter avec Google"
3. Si tout est OK, vous verrez la popup Google
4. Si erreur, vérifiez la console du navigateur pour `auth/unauthorized-domain`

## ❌ Erreurs Courantes

### Erreur : `auth/unauthorized-domain`

**Symptôme** :
```
Firebase: Error (auth/unauthorized-domain).
```

**Cause** : Le domaine n'est pas dans la liste autorisée

**Solution** : Ajouter le domaine dans Firebase Console (voir Étape 2)

### Erreur : `auth/invalid-api-key`

**Symptôme** :
```
Firebase: Error (auth/invalid-api-key).
```

**Cause** : API key incorrecte ou projet mal configuré

**Solution** : Vérifier que `VITE_FIREBASE_API_KEY` dans `.env` correspond au projet Firebase

### Erreur : Popup fermée sans authentification

**Symptôme** : La popup Google s'ouvre puis se ferme immédiatement

**Cause** : Domaine non autorisé ou bloqué par le navigateur

**Solution** :
1. Vérifier la liste des domaines autorisés
2. Désactiver les bloqueurs de popup
3. Tester en navigation privée

## 📊 Tableau de Correspondance

| Élément | Projet ecos-orl-1 | Projet ecos-beaujon | Votre Code Actuel |
|---------|-------------------|---------------------|-------------------|
| Project ID | ecos-orl-1 | ecos-beaujon | ✅ ecos-orl-1 |
| Project Number | 357138285313 | 117971094609 | ✅ 357138285313 |
| API Key | AIzaSyBx7M... | Différent | ✅ AIzaSyBx7M... |
| Auth Domain | ecos-orl-1.firebaseapp.com | ecos-beaujon.firebaseapp.com | ✅ ecos-orl-1.firebaseapp.com |
| Domaine Vercel | ❌ Non autorisé | ecos-infirmier-b-20.vercel.app | ecos-orl-1.vercel.app |

**Conclusion** : Votre code utilise bien `ecos-orl-1`, il faut juste autoriser le domaine Vercel dans ce projet !

## 🔧 Script de Vérification Automatique

Créez un fichier `check-firebase-config.js` :

```javascript
// check-firebase-config.js
async function checkFirebaseConfig() {
  const projectId = 'ecos-orl-1';
  const apiKey = 'AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I';

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/config?key=${apiKey}`
  );

  const config = await response.json();

  console.log('🔍 Domaines autorisés :');
  config.authorizedDomains.forEach(domain => {
    console.log(`  - ${domain}`);
  });

  const requiredDomains = [
    'ecos-orl-1.vercel.app',
    'ecos-orl-1-dave234561s-projects.vercel.app'
  ];

  console.log('\n✅ Vérification :');
  requiredDomains.forEach(domain => {
    const isAuthorized = config.authorizedDomains.includes(domain);
    console.log(`  ${isAuthorized ? '✅' : '❌'} ${domain}`);
  });
}

checkFirebaseConfig();
```

Exécuter :
```bash
node check-firebase-config.js
```

## 📚 Ressources

- [Firebase Authorized Domains Documentation](https://firebase.google.com/docs/auth/web/redirect-best-practices#domain-authorization)
- [Vercel Domain Configuration](https://vercel.com/docs/concepts/projects/domains)
- [Firebase Console - Authentication Settings](https://console.firebase.google.com/project/_/authentication/settings)

## ✅ Checklist Finale

Avant de tester :

- [ ] Firebase Console ouvert sur le bon projet (`ecos-orl-1`)
- [ ] Domaine `ecos-orl-1.vercel.app` ajouté aux domaines autorisés
- [ ] Domaine `ecos-orl-1-dave234561s-projects.vercel.app` ajouté aux domaines autorisés
- [ ] Attente de 2 minutes pour la propagation
- [ ] Test de connexion Google OAuth
- [ ] Vérification des logs du navigateur (pas d'erreur `auth/unauthorized-domain`)

**Une fois fait, l'authentification Google fonctionnera sur Vercel ! 🎉**
