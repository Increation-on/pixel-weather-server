const { getMessaging } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

module.exports = async function handler(req, res) {
  // Добавляем CORS headers
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      fcmToken, 
      channelId = 'pixel_weather_high', // Новый параметр!
      title, 
      body, 
      data 
    } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    console.log(`📤 Отправка уведомления на токен: ${fcmToken.substring(0, 20)}...`);
    console.log(`📤 Канал: ${channelId}`);

    const messaging = getMessaging();

    // Определяем заголовок и текст по типу канала
    let notificationTitle, notificationBody;
    if (channelId.includes('high')) {
      notificationTitle = '⚠️ ВНИМАНИЕ! Гроза!';
      notificationBody = 'Сильный шторм приближается к вашему району';
    } else if (channelId.includes('low')) {
      notificationTitle = '🌤️ Погодное обновление';
      notificationBody = 'Небольшие изменения в прогнозе';
    } else {
      notificationTitle = title || '📊 Изменение погоды';
      notificationBody = body || 'Температура понизится на 5 градусов';
    }

    // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: Только data, без блока notification!
    const message = {
      token: fcmToken,
      
      // ВАЖНО: Только data-сообщения!
      data: {
        // Основные поля для отображения (будет использовать Notifee на клиенте)
        title: notificationTitle,
        body: notificationBody,
        
        // Ключевое поле для определения канала
        channel_id: channelId,
        
        // Дополнительные метаданные
        type: channelId.includes('high') ? 'alert' : 'update',
        severity: channelId.includes('high') ? 'high' : 'normal',
        timestamp: new Date().toISOString(),
        
        // Для совместимости с разными библиотеками
        android_channel_id: channelId,
        sound: channelId.includes('high') ? 'alarm' : 'default',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        priority: channelId.includes('high') ? 'max' : 'normal',
        
        // Любые дополнительные данные из запроса
        ...data
      },
      
      // Настройки Android доставки (не влияют на канал!)
      android: {
        priority: channelId.includes('high') ? 'high' : 'normal',
        ttl: 3600000 // 1 час
      },
      
      // Настройки iOS
      apns: {
        headers: {
          "apns-priority": channelId.includes('high') ? "10" : "5"
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            // Важно: для iOS тоже передаем данные в aps
            alert: {
              title: notificationTitle,
              body: notificationBody
            }
          }
        }
      }
    };

    console.log('📤 Payload для FCM:');
    console.log(JSON.stringify(message, null, 2));

    // Отправляем через Firebase Admin SDK
    const response = await messaging.send(message);
    
    console.log('✅ Успешно отправлено в FCM:', response);

    return res.status(200).json({ 
      success: true,
      message: 'Push sent successfully',
      messageId: response,
      channelId: channelId,
      payload: message.data // Возвращаем что отправили для отладки
    });

  } catch (error) {
    console.error('❌ Ошибка отправки:', error);
    return res.status(500).json({ 
      error: 'Failed to send push',
      details: error.message,
      code: error.code
    });
  }
}; 