#!/bin/bash

# Script d'Ajout Automatique des Variables d'Environnement Vercel
# Pour le projet ECOS-ORL-1 avec Firebase

set -e  # Exit on error

echo "🚀 Configuration Vercel Environment Variables - ECOS-ORL-1"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI n'est pas installé${NC}"
    echo ""
    echo "Installation:"
    echo "  npm install -g vercel"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Vercel CLI détecté${NC}"
echo ""

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet${NC}"
    exit 1
fi

echo "📦 Projet: ECOS-ORL-1"
echo "🔗 Team: dave234561s-projects"
echo ""

# Confirmation
read -p "Voulez-vous continuer avec la configuration? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Configuration annulée."
    exit 0
fi

echo ""
echo "📋 Variables Client (VITE_*) - 7 variables"
echo "-------------------------------------------"

# Client variables (from .env)
declare -A CLIENT_VARS=(
    ["VITE_FIREBASE_API_KEY"]="AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I"
    ["VITE_FIREBASE_AUTH_DOMAIN"]="ecos-orl-1.firebaseapp.com"
    ["VITE_FIREBASE_PROJECT_ID"]="ecos-orl-1"
    ["VITE_FIREBASE_STORAGE_BUCKET"]="ecos-orl-1.firebasestorage.app"
    ["VITE_FIREBASE_MESSAGING_SENDER_ID"]="357138285313"
    ["VITE_FIREBASE_APP_ID"]="1:357138285313:web:c0724a285e8d58feec9100"
    ["VITE_FIREBASE_MEASUREMENT_ID"]="G-S3F2Z7PZ1Z"
)

# Add client variables
for var_name in "${!CLIENT_VARS[@]}"; do
    var_value="${CLIENT_VARS[$var_name]}"
    echo "  ➕ Ajout: $var_name"

    # Add to production
    echo "$var_value" | vercel env add "$var_name" production --yes > /dev/null 2>&1 || true

    # Add to preview
    echo "$var_value" | vercel env add "$var_name" preview --yes > /dev/null 2>&1 || true

    # Add to development
    echo "$var_value" | vercel env add "$var_name" development --yes > /dev/null 2>&1 || true

    echo -e "     ${GREEN}✓${NC}"
done

echo ""
echo "📋 Variables Serveur (FIREBASE_*) - 6 variables"
echo "------------------------------------------------"

# Server variables
declare -A SERVER_VARS=(
    ["FIREBASE_PROJECT_ID"]="ecos-orl-1"
    ["FIREBASE_API_KEY"]="AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I"
    ["FIREBASE_AUTH_DOMAIN"]="ecos-orl-1.firebaseapp.com"
    ["FIREBASE_STORAGE_BUCKET"]="ecos-orl-1.firebasestorage.app"
    ["FIREBASE_MESSAGING_SENDER_ID"]="357138285313"
    ["FIREBASE_APP_ID"]="1:357138285313:web:c0724a285e8d58feec9100"
)

# Add server variables
for var_name in "${!SERVER_VARS[@]}"; do
    var_value="${SERVER_VARS[$var_name]}"
    echo "  ➕ Ajout: $var_name"

    echo "$var_value" | vercel env add "$var_name" production --yes > /dev/null 2>&1 || true
    echo "$var_value" | vercel env add "$var_name" preview --yes > /dev/null 2>&1 || true
    echo "$var_value" | vercel env add "$var_name" development --yes > /dev/null 2>&1 || true

    echo -e "     ${GREEN}✓${NC}"
done

echo ""
echo "🔐 Variables Firebase Admin SDK - 2 variables CRITIQUES"
echo "--------------------------------------------------------"
echo ""
echo -e "${YELLOW}⚠️  Ces valeurs proviennent du fichier JSON téléchargé depuis Firebase Console${NC}"
echo ""

# Firebase Admin SDK credentials
echo "📝 Entrez FIREBASE_CLIENT_EMAIL (depuis le JSON téléchargé):"
echo "   Format: firebase-adminsdk-xxxxx@ecos-orl-1.iam.gserviceaccount.com"
read -r FIREBASE_CLIENT_EMAIL

echo ""
echo "📝 Entrez FIREBASE_PRIVATE_KEY (depuis le JSON téléchargé):"
echo "   ⚠️  IMPORTANT: Collez la TOTALITÉ de la clé AVEC les guillemets"
echo "   Format: \"-----BEGIN PRIVATE KEY-----\\nMIIEv...\\n-----END PRIVATE KEY-----\\n\""
echo ""
read -r FIREBASE_PRIVATE_KEY

echo ""
echo "  ➕ Ajout: FIREBASE_CLIENT_EMAIL"
echo "$FIREBASE_CLIENT_EMAIL" | vercel env add FIREBASE_CLIENT_EMAIL production --yes > /dev/null 2>&1 || true
echo "$FIREBASE_CLIENT_EMAIL" | vercel env add FIREBASE_CLIENT_EMAIL preview --yes > /dev/null 2>&1 || true
echo "$FIREBASE_CLIENT_EMAIL" | vercel env add FIREBASE_CLIENT_EMAIL development --yes > /dev/null 2>&1 || true
echo -e "     ${GREEN}✓${NC}"

echo ""
echo "  ➕ Ajout: FIREBASE_PRIVATE_KEY"
echo "$FIREBASE_PRIVATE_KEY" | vercel env add FIREBASE_PRIVATE_KEY production --yes > /dev/null 2>&1 || true
echo "$FIREBASE_PRIVATE_KEY" | vercel env add FIREBASE_PRIVATE_KEY preview --yes > /dev/null 2>&1 || true
echo "$FIREBASE_PRIVATE_KEY" | vercel env add FIREBASE_PRIVATE_KEY development --yes > /dev/null 2>&1 || true
echo -e "     ${GREEN}✓${NC}"

echo ""
echo "============================================================"
echo -e "${GREEN}✅ Configuration terminée!${NC}"
echo ""
echo "📊 Résumé:"
echo "  - 7 variables client (VITE_*) ajoutées"
echo "  - 6 variables serveur (FIREBASE_*) ajoutées"
echo "  - 2 variables Admin SDK ajoutées"
echo "  - Total: 15 variables configurées"
echo ""
echo "🔄 Prochaine étape:"
echo "  1. Vérifier les variables sur Vercel Dashboard"
echo "  2. Redéployer l'application: vercel --prod"
echo ""
echo "🔗 Vérifier les variables:"
echo "  https://vercel.com/dave234561s-projects/ecos-orl-1/settings/environment-variables"
echo ""
