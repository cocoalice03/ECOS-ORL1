# Firebase Security Configuration Guide

## Current Security Status ✅

Your ECOS-ORL application has proper Firebase security configured:

1. **Environment Variables**: All sensitive credentials stored in `.env` (gitignored)
2. **Storage Security Rules**: Authentication-based access control implemented
3. **No Credential Leaks**: `.env` never committed to git history
4. **Role-Based Access**: Admin operations restricted by email domain

## Security Layers Explained

### Layer 1: API Key (Public - This is OK!)

**Common Misconception**: "Firebase API keys must be kept secret"

**Reality**: Firebase API keys are designed to be included in client code. They are **not secret** and exposing them is **not a security risk** by itself.

```typescript
// This is SAFE in client-side code:
const firebaseConfig = {
  apiKey: "AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I",  // ✅ OK to expose
  authDomain: "ecos-orl-1.firebaseapp.com",           // ✅ OK to expose
  projectId: "ecos-orl-1"                             // ✅ OK to expose
};
```

### Layer 2: Firebase Authentication (Your First Defense)

Security comes from **requiring authentication** before allowing any operations:

```typescript
// In storage.rules
function isAuthenticated() {
  return request.auth != null;  // User must be logged in
}
```

### Layer 3: Security Rules (Your Real Protection)

**Storage Rules** ([storage.rules](storage.rules)):
- ✅ Require authentication for all read operations
- ✅ Restrict write operations by user ownership
- ✅ Admin operations limited to `@admin.com` emails
- ✅ Default deny for unmatched paths

**Current Rules Breakdown**:

```javascript
// Users can only upload to their own profile
match /users/{userId}/profile/{fileName} {
  allow read: if isAuthenticated();
  allow write: if isAuthenticated() && isOwner(userId);
}

// Scenario resources - admins only can write
match /scenarios/{scenarioId}/{fileName} {
  allow read: if isAuthenticated();
  allow write: if isAuthenticated() &&
               request.auth.token.email.matches('.*@admin\\.com$');
}

// Default deny everything else
match /{allPaths=**} {
  allow read, write: if false;
}
```

### Layer 4: Firebase App Check (Recommended Enhancement)

**What it does**: Prevents unauthorized apps/bots from accessing your Firebase services, even if they have your API key.

**How it works**:
1. Verifies requests come from your legitimate app (not scrapers/bots)
2. Uses platform-specific attestation (reCAPTCHA v3 for web)
3. Blocks API calls from unauthorized sources

## Setting Up Firebase App Check (Optional but Recommended)

### 1. Enable App Check in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `ecos-orl-1`
3. Navigate to **Build** → **App Check**
4. Click **Get Started**

### 2. Register Your Web App

1. Click **Apps** → Select your web app
2. Choose provider: **reCAPTCHA v3** (recommended for web)
3. Register a reCAPTCHA v3 site key at [reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
4. Add your site key to Firebase App Check

### 3. Add App Check to Your Code

Install the package:
```bash
npm install firebase/app-check
```

Update `client/src/lib/firebase.ts`:
```typescript
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// After initializing Firebase app
const app = initializeApp(firebaseConfig);

// Initialize App Check with reCAPTCHA v3
if (import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY) {
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY
    ),
    isTokenAutoRefreshEnabled: true
  });
  console.log('✅ Firebase App Check initialized');
}
```

### 4. Add Environment Variable

In `.env`:
```env
# Firebase App Check (reCAPTCHA v3)
VITE_FIREBASE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
```

In `.env.example`:
```env
# Firebase App Check (optional but recommended)
VITE_FIREBASE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
```

### 5. Enforce App Check in Firebase Console

1. Go to **App Check** settings
2. For each service (Storage, Firestore, etc.):
   - Click **Enforce** to require App Check tokens
   - **Warning**: Test in development first!

## What NOT to Expose

While Firebase client API keys are safe, **these should NEVER be public**:

❌ **Firebase Service Account Private Keys**:
```json
// firebase-service-account.json - NEVER commit this!
{
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",  // ❌ SECRET
  "client_email": "firebase-adminsdk@..."            // ❌ SECRET
}
```

✅ **Already protected** in your `.gitignore`:
```gitignore
firebase-service-account.json
.env
.env.local
```

❌ **Backend API Keys** (if different from client):
- OpenAI API keys
- Database credentials
- JWT secret keys
- Payment processor keys

## Current `.env` Structure (Reference)

```env
# Firebase Client Configuration (VITE_ prefix for Vite)
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Server Configuration (Node.js)
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (NEVER commit these!)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Other Services
OPENAI_API_KEY=your_openai_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
DATABASE_URL=postgresql://...
```

## Security Checklist

- [x] `.env` is in `.gitignore`
- [x] Service account JSON is in `.gitignore`
- [x] Firebase Storage Rules configured with authentication
- [x] Admin operations restricted by email domain
- [x] Environment variables used in code (not hardcoded)
- [ ] Firebase App Check enabled (optional but recommended)
- [ ] Firestore Security Rules configured (if using Firestore)
- [ ] Regular security rules audit scheduled

## Testing Security Rules

### Local Testing with Firebase Emulator

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize emulators
firebase init emulators

# Start emulators
firebase emulators:start
```

### Manual Security Testing

Test your storage rules:
1. Try uploading without authentication → Should fail
2. Try accessing another user's profile → Should fail
3. Try uploading as admin with @admin.com email → Should succeed
4. Try uploading as regular user → Should fail for scenarios

## Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Firebase App Check Guide](https://firebase.google.com/docs/app-check)
- [Firebase Authentication Best Practices](https://firebase.google.com/docs/auth/web/start)
- [Understanding Firebase API Keys](https://firebase.google.com/docs/projects/api-keys)

## Summary

Your Firebase configuration is **already secure** because:

1. ✅ API keys are meant to be public in Firebase's security model
2. ✅ Real security comes from Authentication + Security Rules (which you have)
3. ✅ Sensitive service account credentials are properly gitignored
4. ✅ Environment variables properly configured
5. ✅ Storage rules enforce authentication and ownership

**Optional Next Step**: Implement Firebase App Check for additional bot/abuse protection.
