// Vercel serverless handler using ServerlessApplication
// This handler delegates to the fully-initialized Express app from serverless-app.ts

import { serverlessApp } from './_lib/serverless-app.js';

export default async function handler(req, res) {
  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Use the ServerlessApplication's handleRequest method
    await serverlessApp.handleRequest(req, res);
  } catch (error) {
    console.error('❌ Serverless handler error:', error);

    // Fallback error response
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-vercel-id'] || 'unknown'
      });
    }
  }
}
