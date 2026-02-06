// Регистрация FCM токена и локации пользователя
export default async function handler(req, res) {
  // Разрешаем запросы только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fcmToken, latitude, longitude, userId } = req.body;

    // Проверяем обязательные поля
    if (!fcmToken || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required fields: fcmToken, latitude, longitude' 
      });
    }

    // Здесь позже добавим сохранение в базу данных
    console.log('Device registered:', { 
      fcmToken: fcmToken.substring(0, 20) + '...',
      latitude, 
      longitude,
      userId: userId || 'anonymous'
    });

    // Успешный ответ
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