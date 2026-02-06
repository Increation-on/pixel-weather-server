import { initializeFirebase } from '../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fcmToken, latitude, longitude, userId } = req.body;

    if (!fcmToken || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Инициализируем Firebase (для будущих push-уведомлений)
    initializeFirebase();

    // TODO: Сохранить в базу данных (Vercel KV)
    // Пока просто логируем
    console.log('Device registered:', { 
      fcmToken: fcmToken.substring(0, 20) + '...',
      latitude, 
      longitude,
      userId: userId || 'anonymous'
    });

    // Можно сразу отправить тестовое уведомление
    // await sendTestNotification(fcmToken);

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
}