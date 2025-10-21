// Minimal test endpoint to verify Vercel serverless function works
export default async function handler(req, res) {
  res.status(200).json({
    status: 'OK',
    message: 'Minimal serverless function works!',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasFirebaseVars: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL),
      hasSupabaseVars: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    }
  });
}
