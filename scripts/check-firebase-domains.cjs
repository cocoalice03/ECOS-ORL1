#!/usr/bin/env node
/**
 * Firebase Domain Configuration Checker
 *
 * Vérifie que les domaines Vercel sont autorisés dans Firebase
 */

const https = require('https');

// Configuration from .env
const CONFIG = {
  projectId: 'ecos-orl-1',
  apiKey: 'AIzaSyBx7MmV0lxFAL8ASEAdOdDaDBJhL5R-x1I',
  requiredDomains: [
    'localhost',
    'ecos-orl-1.vercel.app',
    'ecos-orl-1-dave234561s-projects.vercel.app',
    'ecos-orl-1.firebaseapp.com',
    'ecos-orl-1.web.app'
  ]
};

/**
 * Fetch Firebase configuration
 */
function fetchFirebaseConfig() {
  return new Promise((resolve, reject) => {
    const url = `https://identitytoolkit.googleapis.com/v1/projects/${CONFIG.projectId}/config?key=${CONFIG.apiKey}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const config = JSON.parse(data);
          resolve(config);
        } catch (error) {
          reject(new Error('Failed to parse Firebase config: ' + error.message));
        }
      });
    }).on('error', (error) => {
      reject(new Error('Failed to fetch Firebase config: ' + error.message));
    });
  });
}

/**
 * Main verification function
 */
async function checkDomainConfiguration() {
  console.log('🔍 Firebase Domain Configuration Checker\n');
  console.log('📦 Project:', CONFIG.projectId);
  console.log('🔑 API Key:', CONFIG.apiKey.substring(0, 20) + '...\n');

  try {
    console.log('⏳ Fetching Firebase configuration...\n');
    const config = await fetchFirebaseConfig();

    if (!config.authorizedDomains) {
      console.error('❌ No authorized domains found in Firebase config');
      process.exit(1);
    }

    // Display all authorized domains
    console.log('✅ Authorized Domains in Firebase:');
    config.authorizedDomains.forEach((domain, index) => {
      console.log(`   ${index + 1}. ${domain}`);
    });
    console.log('');

    // Check required domains
    console.log('🎯 Required Domains Check:\n');
    let allDomainsAuthorized = true;

    CONFIG.requiredDomains.forEach(domain => {
      const isAuthorized = config.authorizedDomains.includes(domain);
      const status = isAuthorized ? '✅' : '❌';
      console.log(`   ${status} ${domain}`);

      if (!isAuthorized) {
        allDomainsAuthorized = false;
      }
    });

    console.log('');

    // Final verdict
    if (allDomainsAuthorized) {
      console.log('🎉 SUCCESS: All required domains are authorized!');
      console.log('');
      console.log('You can now use Firebase Authentication from:');
      CONFIG.requiredDomains.forEach(domain => {
        console.log(`   - https://${domain}`);
      });
      process.exit(0);
    } else {
      console.log('⚠️  WARNING: Some domains are NOT authorized!');
      console.log('');
      console.log('🔧 To fix this:');
      console.log('');
      console.log('1. Open Firebase Console:');
      console.log(`   https://console.firebase.google.com/project/${CONFIG.projectId}/authentication/settings`);
      console.log('');
      console.log('2. Scroll to "Authorized domains" section');
      console.log('');
      console.log('3. Click "Add domain" and add each missing domain:');
      CONFIG.requiredDomains.forEach(domain => {
        if (!config.authorizedDomains.includes(domain)) {
          console.log(`   ❌ ${domain}`);
        }
      });
      console.log('');
      console.log('4. Wait 1-2 minutes for propagation');
      console.log('');
      console.log('5. Run this script again to verify');
      console.log('');
      console.log('📖 For detailed instructions, see: FIREBASE_DOMAIN_FIX_GUIDE.md');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log('   - Verify your API key is correct in the script');
    console.log('   - Check your internet connection');
    console.log('   - Ensure the Firebase project exists');
    console.log(`   - Visit: https://console.firebase.google.com/project/${CONFIG.projectId}`);
    process.exit(1);
  }
}

// Run the checker
checkDomainConfiguration();
