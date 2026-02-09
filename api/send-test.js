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
    title: '🔥 FIREBASE MAX PRIORITY',
    body: 'Тест с максимальным приоритетом'
  },
  android: {
    priority: "high",  // ← high для доставки
    ttl: 3600000, // 1 час
    notification: {
      sound: "default",
      channel_id: "pixel_weather_alerts",
      notification_priority: "PRIORITY_MAX",  // ← MAX для отображения
      visibility: "PUBLIC",
      default_sound: true,
      default_vibrate_timings: true,
      default_light_settings: true
    }
  },
  apns: {
    headers: {
      "apns-priority": "10"  // Максимум для iOS
    },
    payload: {
      aps: {
        alert: {
          title: '🔥 FIREBASE MAX PRIORITY',
          body: 'Тест с максимальным приоритетом'
        },
        sound: "default",
        badge: 1
      }
    }
  },
  data: {
    priority: "max",
    force_display: "true",
    timestamp: new Date().toISOString()
  }
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