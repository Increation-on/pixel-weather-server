//firebase.js
const admin = require('firebase-admin');

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  console.log('FIREBASE_SERVICE_ACCOUNT exists:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('Length:', process.env.FIREBASE_SERVICE_ACCOUNT?.length);
  
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing');
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Parsed successfully, project_id:', serviceAccount.project_id);
    
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('JSON parse error:', error.message);
    console.error('First 100 chars:', 
      process.env.FIREBASE_SERVICE_ACCOUNT?.substring(0, 100));
    throw error;
  }
}

function getMessaging() {
  initializeFirebase();
  return admin.messaging();
}

module.exports = { initializeFirebase, getMessaging };