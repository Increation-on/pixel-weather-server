const { getMessaging } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

module.exports = async function handler(req, res) {
  // Добавляем CORS headers
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fcmToken, title = '🌤️ Pixel Weather Test', body = 'Push notifications are working!', data } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    const messaging = getMessaging();

    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channel_id: "weather"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true
          }
        }
      },
      data: data || { timestamp: new Date().toISOString(), type: 'test' }
    };

    const response = await messaging.send(message);
    
    console.log('Test push sent:', response);

    return res.status(200).json({ 
      success: true,
      message: 'Test push sent successfully',
      response: response
    });

  } catch (error) {
    console.error('Push sending error:', error);
    return res.status(500).json({ 
      error: 'Failed to send push',
      details: error.message 
    });
  }
};