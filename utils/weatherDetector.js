// pixel-weather-server/utils/weatherDetector.js

// Экстренные пороги (по критериям МЧС)
const EMERGENCY_THRESHOLDS = {
  WIND: {
    STORM: 25,      // м/с - штормовое предупреждение
    HURRICANE: 33,  // м/с - ураган
    TORNADO: 50     // м/с - смерч
  },
  RAIN: {
    HEAVY_PER_HOUR: 30,     // мм за час - сильный ливень
    VERY_HEAVY_12H: 50      // мм за 12 часов - очень сильный дождь
  },
  SNOW: {
    HEAVY_12H: 20           // мм за 12 часов - сильный снегопад
  },
  VISIBILITY: {
    DENSE_FOG: 100,         // метров - сильный туман
    EXTREME_FOG: 50         // метров - очень сильный туман
  }
};

/**
 * Определяет КАТЕГОРИЮ погоды по WMO коду
 */
export function getWeatherCategory(weatherCode) {
  if (weatherCode === 0) return 'ясно';
  if (weatherCode >= 1 && weatherCode <= 3) return 'облачно';
  if (weatherCode >= 45 && weatherCode <= 48) return 'туман';
  if (weatherCode >= 51 && weatherCode <= 67) return 'дождь';
  if (weatherCode >= 71 && weatherCode <= 77) return 'снег';
  if (weatherCode >= 80 && weatherCode <= 82) return 'ливень';
  if (weatherCode >= 85 && weatherCode <= 86) return 'снегопад';
  if (weatherCode >= 95 && weatherCode <= 99) return 'гроза';
  return 'неизвестно';
}

/**
 * Проверяет на экстренные погодные явления
 * Возвращает массив экстренных уведомлений
 */
export function checkEmergencyWeather(weatherData) {
  const emergencies = [];
  
  if (!weatherData) return emergencies;
  
  // 1️⃣ ЭКСТРЕННЫЙ ВЕТЕР
  if (weatherData.windSpeed >= EMERGENCY_THRESHOLDS.WIND.HURRICANE) {
    emergencies.push({
      level: 'КРАСНЫЙ',
      type: 'wind',
      title: '⚡ УРАГАН!',
      body: `Ветер ${weatherData.windSpeed} м/с. Экстренное предупреждение! Избегайте улиц, держитесь подальше от деревьев и линий электропередач.`,
      priority: 'high'
    });
  } else if (weatherData.windSpeed >= EMERGENCY_THRESHOLDS.WIND.STORM) {
    emergencies.push({
      level: 'ОРАНЖЕВЫЙ',
      type: 'wind',
      title: '💨 ШТОРМОВОЕ ПРЕДУПРЕЖДЕНИЕ',
      body: `Ветер до ${weatherData.windSpeed} м/с. Будьте осторожны на улице, возможны повреждения.`,
      priority: 'high'
    });
  }
  
  // 2️⃣ ЭКСТРЕННЫЕ ОСАДКИ (ливень)
  if (weatherData.precipitation >= EMERGENCY_THRESHOLDS.RAIN.HEAVY_PER_HOUR) {
    emergencies.push({
      level: 'ОРАНЖЕВЫЙ',
      type: 'rain',
      title: '🌊 СИЛЬНЫЙ ЛИВЕНЬ',
      body: `${weatherData.precipitation} мм осадков за час. Возможны подтопления, будьте осторожны.`,
      priority: 'high'
    });
  }
  
  // 3️⃣ СИЛЬНЫЙ СНЕГОПАД
  if (weatherData.precipitation >= EMERGENCY_THRESHOLDS.SNOW.HEAVY_12H && 
      getWeatherCategory(weatherData.weatherCode) === 'снегопад') {
    emergencies.push({
      level: 'ОРАНЖЕВЫЙ',
      type: 'snow',
      title: '❄️ СИЛЬНЫЙ СНЕГОПАД',
      body: `Обильные осадки. На дорогах гололедица, по возможности оставайтесь дома.`,
      priority: 'medium'
    });
  }
  
  // 4️⃣ ГРОЗА
  if (getWeatherCategory(weatherData.weatherCode) === 'гроза') {
    emergencies.push({
      level: 'ЖЁЛТЫЙ',
      type: 'thunderstorm',
      title: '⚡ ГРОЗА',
      body: 'На улице гроза. Оставайтесь в помещении, не пользуйтесь электроприборами.',
      priority: 'medium'
    });
  }
  
  // 5️⃣ СИЛЬНЫЙ ТУМАН (видимость определяем косвенно по коду)
  if (weatherData.weatherCode >= 45 && weatherData.weatherCode <= 48) {
    emergencies.push({
      level: 'ЖЁЛТЫЙ',
      type: 'fog',
      title: '🌫️ СИЛЬНЫЙ ТУМАН',
      body: 'Плохая видимость на дорогах. Будьте внимательны за рулём.',
      priority: 'medium'
    });
  }
  
  return emergencies;
}

/**
 * Детектирует значимые изменения погоды (±5°C)
 */
export function detectWeatherChanges(oldSnapshot, newData) {
  const changes = [];
  
  if (!oldSnapshot || !newData) return changes;
  
  // 1. Температура ±5°C
  if (oldSnapshot.temperature !== undefined && newData.temperature !== undefined) {
    const tempDiff = Math.abs(newData.temperature - oldSnapshot.temperature);
    if (tempDiff >= 5) {
      const direction = newData.temperature > oldSnapshot.temperature ? '↑' : '↓';
      changes.push({
        type: 'temperature',
        text: `Температура ${direction} на ${tempDiff.toFixed(1)}°C`,
        priority: 'normal'
      });
    }
  }

  // 2. Категория погоды
  const oldCategory = getWeatherCategory(oldSnapshot.weatherCode);
  const newCategory = getWeatherCategory(newData.weatherCode);
  
  if (oldCategory !== newCategory) {
    let text = '';
    let priority = 'normal';
    
    if (newCategory === 'гроза') {
      text = '⚡ НАЧАЛАСЬ ГРОЗА!';
      priority = 'high';
    } else if (newCategory === 'ливень') {
      text = '💦 СИЛЬНЫЙ ЛИВЕНЬ';
      priority = 'high';
    } else if (newCategory === 'снегопад') {
      text = '❄️ СНЕГОПАД';
      priority = 'high';
    } else if (oldCategory === 'ясно' && newCategory === 'дождь') {
      text = '🌧️ Пошел дождь';
    } else if (oldCategory === 'ясно' && newCategory === 'снег') {
      text = '❄️ Пошел снег';
    } else {
      text = `${oldCategory} → ${newCategory}`;
    }
    
    changes.push({ type: 'category', text, priority });
  }

  // 3. Изменение ветра (порог 5 м/с)
  if (oldSnapshot.windSpeed !== undefined && newData.windSpeed !== undefined) {
    const windDiff = Math.abs(newData.windSpeed - oldSnapshot.windSpeed);
    if (windDiff >= 5) {
      const direction = newData.windSpeed > oldSnapshot.windSpeed ? 'усилился' : 'ослаб';
      changes.push({
        type: 'wind',
        text: `💨 Ветер ${direction} (${oldSnapshot.windSpeed}→${newData.windSpeed} м/с)`,
        priority: 'normal'
      });
    }
  }

  return changes;
}

/**
 * Получает данные о погоде из OpenWeatherMap
 */
export async function fetchWeatherFromOpenWeather(lat, lon, apiKey) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather API error');
  
  const data = await response.json();
  
  return {
    temperature: data.main.temp,
    weatherCode: convertOpenWeatherCode(data.weather[0].id),
    precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
    windSpeed: data.wind.speed
  };
}

/**
 * Конвертирует OpenWeatherMap code в WMO code
 */
function convertOpenWeatherCode(openWeatherCode) {
  // Группы кодов
  if (openWeatherCode >= 200 && openWeatherCode < 300) return 95; // Гроза
  if (openWeatherCode >= 300 && openWeatherCode < 400) return 51; // Морось
  if (openWeatherCode >= 500 && openWeatherCode < 600) return 61; // Дождь
  if (openWeatherCode >= 600 && openWeatherCode < 700) return 71; // Снег
  if (openWeatherCode >= 700 && openWeatherCode < 800) return 45; // Туман
  if (openWeatherCode === 800) return 0; // Ясно
  if (openWeatherCode === 801) return 1;  // Облачно
  if (openWeatherCode === 802) return 2;
  if (openWeatherCode === 803 || openWeatherCode === 804) return 3;
  
  return 0;
}