module.exports = async function handler(req, res) {
  console.log('FIREBASE_SERVICE_ACCOUNT exists:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('Length:', process.env.FIREBASE_SERVICE_ACCOUNT?.length);
  
  try {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    console.log('Parsed successfully, project_id:', parsed.project_id);
    
    return res.json({
      hasEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      length: process.env.FIREBASE_SERVICE_ACCOUNT?.length,
      projectId: parsed.project_id,
      error: null
    });
  } catch (e) {
    console.error('Parse error:', e.message);
    return res.json({
      hasEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      error: e.message,
      sample: process.env.FIREBASE_SERVICE_ACCOUNT?.substring(0, 50) + '...'
    });
  }
}