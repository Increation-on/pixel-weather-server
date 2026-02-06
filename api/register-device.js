const { initializeFirebase } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

module.exports = async function handler(req, res) {
  // Добавляем CORS headers
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fcmToken, latitude, longitude, userId } = req.body;

    if (!fcmToken || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required fields: fcmToken, latitude, longitude' 
      });
    }

    // Инициализируем Firebase
    initializeFirebase();

    // TODO: Сохранить в базу данных (Vercel KV)
    console.log('Device registered:', { 
      fcmToken: fcmToken.substring(0, 20) + '...',
      latitude, 
      longitude,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ 
      success: true,
      message: 'Device registered successfully',
      registeredAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};