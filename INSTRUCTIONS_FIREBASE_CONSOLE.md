# Instructions Firebase Console - À Suivre Maintenant

## ⚠️ IMPORTANT: Actions Manuelles Requises

Ces étapes doivent être effectuées **manuellement** dans Firebase Console car je ne peux pas y accéder directement.

---

## Phase 1.1: Vérifier le Projet Firebase `ecos-orl-1`

### Étape 1: Ouvrir Firebase Console

1. Allez sur https://console.firebase.google.com/
2. Vous verrez la liste de vos projets Firebase

### Étape 2: Identifier Vos Projets

Recherchez ces projets dans la liste:
- **ECOS ORL 1** (ou `ecos-orl-1`)
- **ECOS Beaujon** (ou `ecos-beaujon`)

### Étape 3: Vérifier le Projet ID

1. Cliquez sur le projet **"ECOS ORL 1"**
2. Allez dans **Project Settings** (⚙️ en haut à gauche)
3. Vérifiez que:
   - Project ID = `ecos-orl-1`
   - Project number = `357138285313`
   - Web API Key commence par `AIzaSyBx7MmV0lx...`

### ✅ Résultat Attendu

Si ces valeurs correspondent, vous êtes sur le BON projet! Continuez à la Phase 1.2.

---

## Phase 1.2: Ajouter les Domaines Autorisés

### Lien Direct

```
https://console.firebase.google.com/project/ecos-orl-1/authentication/settings
```

### Étape 1: Navigation

1. Dans le projet `ecos-orl-1`, cliquez sur **"Authentication"** dans le menu de gauche
2. Cliquez sur l'onglet **"Settings"** (en haut)
3. Faites défiler jusqu'à la section **"Authorized domains"**

### Étape 2: Vérifier les Domaines Actuels

Vous devriez voir:
- `localhost`
- `ecos-orl-1.firebaseapp.com`
- `ecos-orl-1.web.app`

### Étape 3: Ajouter les Domaines Vercel

1. Cliquez sur **"Add domain"**
2. Entrez: `ecos-orl-1.vercel.app`
3. Cliquez **"Add"**
4. Cliquez à nouveau sur **"Add domain"**
5. Entrez: `ecos-orl-1-dave234561s-projects.vercel.app`
6. Cliquez **"Add"**

### ✅ Résultat Attendu

La liste doit maintenant afficher:
```
✓ localhost
✓ ecos-orl-1.firebaseapp.com
✓ ecos-orl-1.web.app
✓ ecos-orl-1.vercel.app                            ← NOUVEAU
✓ ecos-orl-1-dave234561s-projects.vercel.app      ← NOUVEAU
```

### 📸 Vérification Visuelle

Faites une capture d'écran de la liste complète des domaines autorisés pour confirmer.

---

## Phase 1.3: Générer les Credentials Firebase Admin SDK

### Lien Direct

```
https://console.firebase.google.com/project/ecos-orl-1/settings/serviceaccounts/adminsdk
```

### Étape 1: Générer la Clé

1. Allez sur le lien ci-dessus
2. Cliquez sur **"Generate new private key"** (bouton bleu)
3. Une popup de confirmation apparaît
4. Cliquez sur **"Generate key"**
5. Un fichier JSON sera téléchargé automatiquement
   - Nom du fichier: `ecos-orl-1-firebase-adminsdk-xxxxx-xxxxxxxx.json`

### Étape 2: Ouvrir le Fichier JSON

1. Ouvrez le fichier JSON téléchargé avec un éditeur de texte
2. Vous verrez quelque chose comme:

```json
{
  "type": "service_account",
  "project_id": "ecos-orl-1",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@ecos-orl-1.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

### Étape 3: Copier les Valeurs Critiques

Vous aurez besoin de copier ces 3 valeurs:

#### 3.1 - FIREBASE_PROJECT_ID
```
Valeur: ecos-orl-1
```

#### 3.2 - FIREBASE_CLIENT_EMAIL
```
Valeur: firebase-adminsdk-xxxxx@ecos-orl-1.iam.gserviceaccount.com
```
*(Remplacez `xxxxx` par la vraie valeur du fichier)*

#### 3.3 - FIREBASE_PRIVATE_KEY

⚠️ **ATTENTION**: Cette valeur est LONGUE et contient des caractères spéciaux!

```json
Valeur: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BA...(très long)...\n-----END PRIVATE KEY-----\n"
```

**Points critiques:**
- ✅ **Gardez les guillemets** au début et à la fin
- ✅ **Gardez tous les `\n`** (backslash-n) dans la clé
- ✅ Copiez la TOTALITÉ de la clé (généralement ~1600 caractères)
- ❌ Ne supprimez AUCUN caractère

### 📝 Format Final pour Vercel

Créez un fichier temporaire `.env.vercel-firebase` avec ces valeurs:

```env
# Firebase Admin SDK Credentials pour Vercel
# À copier dans Vercel Environment Variables

FIREBASE_PROJECT_ID=ecos-orl-1

FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ecos-orl-1.iam.gserviceaccount.com

FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...(copier la clé complète ici)...\n-----END PRIVATE KEY-----\n"
```

### ✅ Résultat Attendu

- [ ] Fichier JSON téléchargé
- [ ] `FIREBASE_PROJECT_ID` extrait
- [ ] `FIREBASE_CLIENT_EMAIL` extrait
- [ ] `FIREBASE_PRIVATE_KEY` extrait (avec guillemets et `\n`)
- [ ] Fichier `.env.vercel-firebase` créé avec les 3 valeurs

---

## ⚠️ Sécurité

**NE PARTAGEZ JAMAIS:**
- Le fichier JSON téléchargé
- La clé privée (`FIREBASE_PRIVATE_KEY`)
- L'email du service account dans des dépôts publics

**BON:**
- Ajouter ces valeurs dans Vercel Environment Variables (sécurisé)
- Stocker le fichier JSON dans un gestionnaire de mots de passe
- Ajouter `.env.vercel-firebase` à `.gitignore`

---

## 📋 Checklist Complète Phase 1

Avant de passer à la Phase 2, vérifiez:

- [ ] ✅ Projet `ecos-orl-1` confirmé dans Firebase Console
- [ ] ✅ Domaine `ecos-orl-1.vercel.app` ajouté
- [ ] ✅ Domaine `ecos-orl-1-dave234561s-projects.vercel.app` ajouté
- [ ] ✅ Capture d'écran de la liste des domaines autorisés
- [ ] ✅ Service Account Key JSON téléchargée
- [ ] ✅ `FIREBASE_PROJECT_ID` extrait
- [ ] ✅ `FIREBASE_CLIENT_EMAIL` extrait
- [ ] ✅ `FIREBASE_PRIVATE_KEY` extrait (format correct)
- [ ] ✅ Fichier `.env.vercel-firebase` créé

---

## 🆘 En Cas de Problème

### Problème 1: Le projet `ecos-orl-1` n'existe pas

**Solution**: Vous devez utiliser le projet `ecos-beaujon` à la place.

**Actions**:
1. Arrêtez ce processus
2. Contactez-moi pour adapter le plan au projet `ecos-beaujon`
3. Je devrai modifier votre `.env` local pour correspondre

### Problème 2: Impossible d'ajouter les domaines Vercel

**Cause possible**: Limite du plan Firebase gratuit

**Solution**:
1. Supprimez les anciens domaines non utilisés (`ecos-infirmier-b-20.vercel.app`)
2. Ou passez au plan Blaze (pay-as-you-go) de Firebase

### Problème 3: Erreur lors de la génération de la clé

**Solution**:
1. Vérifiez que vous avez les droits Owner/Editor sur le projet
2. Essayez en navigation privée
3. Déconnectez-vous et reconnectez-vous à Firebase Console

---

## ➡️ Prochaine Étape

Une fois toutes les cases de la checklist cochées, passez à:

**Phase 2: Configuration Vercel**

Je vais maintenant configurer automatiquement les variables d'environnement Vercel avec les valeurs que vous avez extraites.

**M'informer dès que vous avez terminé la Phase 1!**
