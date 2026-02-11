const addCorsHeaders = require('./_cors.js');

// 🔴 ВРЕМЕННОЕ ХРАНИЛИЩЕ В ПАМЯТИ (данные потеряются при перезапуске сервера)
const deviceStorage = new Map();

module.exports = async function handler(req, res) {
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { expoPushToken, latitude, longitude, userId } = req.body;

    if (!expoPushToken || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required fields: expoPushToken, latitude, longitude' 
      });
    }

    // 🔴 СОЗДАЕМ УНИКАЛЬНЫЙ ID ДЛЯ УСТРОЙСТВА
    const deviceId = userId || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 🔴 СОХРАНЯЕМ В ПАМЯТИ
    deviceStorage.set(deviceId, {
      expoPushToken,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      registeredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    console.log('📱 Устройство зарегистрировано:', { 
      deviceId,
      tokenPreview: expoPushToken.substring(0, 30) + '...',
      coordinates: `${latitude}, ${longitude}`,
      totalDevices: deviceStorage.size
    });

    // 🔴 ДЛЯ ОТЛАДКИ: выводим список всех устройств
    console.log('📋 Список всех зарегистрированных устройств:');
    deviceStorage.forEach((device, id) => {
      console.log(`  - ${id}: ${device.expoPushToken.substring(0, 25)}... (${device.latitude}, ${device.longitude})`);
    });

    return res.status(200).json({ 
      success: true,
      message: 'Expo Push Token зарегистрирован',
      deviceId: deviceId,
      registeredAt: new Date().toISOString(),
      storageType: 'in-memory (temporary)',
      totalDevices: deviceStorage.size,
      warning: 'Данные хранятся в памяти сервера и будут потеряны при его перезапуске'
    });

  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// 🔴 ЭКСПОРТИРУЕМ ХРАНИЛИЩЕ ДЛЯ ИСПОЛЬЗОВАНИЯ В ДРУГИХ ФАЙЛАХ
module.exports.deviceStorage = deviceStorage;