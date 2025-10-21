# Vercel Firebase Environment Variables Setup

## Problem
The production deployment at `https://ecos-infirmier-b-20.vercel.app` is failing with:
```
POST /api/auth/firebase-login 500 (Internal Server Error)
FUNCTION_INVOCATION_FAILED
```

## Root Cause
Firebase Admin SDK is not initialized because required environment variables are **missing in Vercel**.

## Required Environment Variables

You must add these three environment variables to your Vercel project:

### 1. FIREBASE_PROJECT_ID
- **Description**: Your Firebase project ID
- **Example**: `ecos-infirmier-project`
- **Where to find**: Firebase Console → Project Settings → General → Project ID

### 2. FIREBASE_CLIENT_EMAIL
- **Description**: Service account email for Firebase Admin SDK
- **Example**: `firebase-adminsdk-xxxxx@ecos-infirmier-project.iam.gserviceaccount.com`
- **Where to find**: Firebase Console → Project Settings → Service Accounts → Firebase Admin SDK

### 3. FIREBASE_PRIVATE_KEY
- **Description**: Private key from Firebase service account (with newlines)
- **Example**: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----\n`
- **Where to find**: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
- **IMPORTANT**: The private key contains `\n` characters that must be preserved

## How to Add Environment Variables to Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: `ecos-infirmier-b-20`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: `FIREBASE_PROJECT_ID`
   - **Value**: (paste your project ID)
   - **Environment**: Select **Production**, **Preview**, and **Development**
   - Click **Save**

5. Repeat for `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`

6. **Redeploy** your application:
   - Go to **Deployments** tab
   - Click **...** on the latest deployment
   - Select **Redeploy**

### Option 2: Via Vercel CLI

```bash
# Login to Vercel
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add FIREBASE_PROJECT_ID production
# Paste value when prompted

vercel env add FIREBASE_CLIENT_EMAIL production
# Paste value when prompted

vercel env add FIREBASE_PRIVATE_KEY production
# Paste value when prompted (include the \n characters)

# Redeploy
vercel --prod
```

## Getting Firebase Service Account Credentials

If you don't have the service account credentials yet:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **⚙️ Settings** → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file

The JSON file contains:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",          ← FIREBASE_PROJECT_ID
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",  ← FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-...@your-project.iam.gserviceaccount.com",  ← FIREBASE_CLIENT_EMAIL
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

Extract the three values marked above.

## Verification

After adding the environment variables and redeploying:

1. Visit: https://ecos-infirmier-b-20.vercel.app/login
2. Try to log in with your credentials
3. Check browser console - you should **NOT** see:
   - `FUNCTION_INVOCATION_FAILED`
   - `500 Internal Server Error` on `/api/auth/firebase-login`

4. Successful login should show:
   - User redirected to dashboard/admin page
   - No errors in console

## Additional Environment Variables

Your Vercel deployment also needs these (likely already configured):

- `DATABASE_URL` or `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (for AI features)
- `PINECONE_API_KEY` (for vector search, optional)

## Security Notes

⚠️ **NEVER commit these values to git**
- The `firebase-service-account.json` is already in `.gitignore`
- Environment variables should only exist in Vercel dashboard
- Keep the service account JSON file secure

## Troubleshooting

### Error: "Missing required environment variables"
- Double-check all three variables are added in Vercel
- Make sure they're enabled for "Production" environment
- Redeploy after adding variables

### Error: "Invalid or expired Firebase ID token"
- Check that `FIREBASE_PROJECT_ID` matches your actual Firebase project
- Verify `FIREBASE_CLIENT_EMAIL` is correct
- Make sure `FIREBASE_PRIVATE_KEY` includes the full key with `\n` newlines

### Still getting 500 errors?
Check Vercel function logs:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Go to **Functions** tab
4. Click on `api/index.js` to see logs
5. Look for Firebase initialization errors

## Related Files

- Firebase Admin Service: `server/services/firebase-admin.service.ts`
- Firebase Auth Middleware: `server/middleware/firebase-auth.middleware.ts`
- Login Route: `server/routes.ts` (line 180: `/api/auth/firebase-login`)
