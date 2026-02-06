const addCorsHeaders = require('./_cors.js');

module.exports = async function handler(req, res) {
  if (addCorsHeaders(req, res)) return;

  const envVars = Object.keys(process.env).filter(k => 
    k.includes('FIREBASE') || k.includes('VERCEL')
  );
  
  const result = {
    server: 'Pixel Weather Push Server',
    status: 'online',
    timestamp: new Date().toISOString(),
    allEnvVars: envVars,
    hasFirebaseVar: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    firebaseLength: process.env.FIREBASE_SERVICE_ACCOUNT?.length,
    first50Chars: process.env.FIREBASE_SERVICE_ACCOUNT?.substring(0, 50),
    vercelEnv: process.env.VERCEL_ENV
  };

  console.log('Debug endpoint called:', result);
  
  return res.json(result);
};