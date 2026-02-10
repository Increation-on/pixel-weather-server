const { getMessaging } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

module.exports = async function handler(req, res) {
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    const messaging = getMessaging();
    const results = [];
    const timestamp = new Date().toISOString();

    // Тест HIGH канала
    try {
      await messaging.send({
        token: fcmToken,
        data: {
          title: '⚠️ ТЕСТ: HIGH канал',
          body: 'Экстренное уведомление с вибрацией',
          channel_id: 'pixel_weather_high',
          type: 'test_channels',
          priority: 'high',
          timestamp: timestamp
        },
        android: { priority: 'high' }
      });
      results.push({ channel: 'high', success: true });
      console.log('✅ HIGH канал протестирован');
    } catch (error) {
      results.push({ channel: 'high', success: false, error: error.message });
    }

    // Тест DEFAULT канала
    try {
      await messaging.send({
        token: fcmToken,
        data: {
          title: '📊 ТЕСТ: DEFAULT канал',
          body: 'Обычное уведомление об изменении погоды',
          channel_id: 'pixel_weather_default',
          type: 'test_channels',
          priority: 'default',
          timestamp: timestamp
        },
        android: { priority: 'normal' }
      });
      results.push({ channel: 'default', success: true });
      console.log('✅ DEFAULT канал протестирован');
    } catch (error) {
      results.push({ channel: 'default', success: false, error: error.message });
    }

    // Тест LOW канала
    try {
      await messaging.send({
        token: fcmToken,
        data: {
          title: '🌤️ ТЕСТ: LOW канал',
          body: 'Тихое обновление без звука',
          channel_id: 'pixel_weather_low',
          type: 'test_channels',
          priority: 'low',
          timestamp: timestamp
        },
        android: { priority: 'normal' }
      });
      results.push({ channel: 'low', success: true });
      console.log('✅ LOW канал протестирован');
    } catch (error) {
      results.push({ channel: 'low', success: false, error: error.message });
    }

    // Сводка
    const successCount = results.filter(r => r.success).length;
    
    return res.status(200).json({ 
      success: successCount === 3,
      message: `Протестировано ${successCount}/3 каналов`,
      results: results,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('❌ Ошибка тестирования каналов:', error);
    return res.status(500).json({ 
      error: 'Failed to test channels',
      details: error.message
    });
  }
};