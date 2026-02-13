// pixel-weather-server/utils/weatherDetector.js

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
 * Детектирует значимые изменения погоды (±5°C)
 */
export function detectWeatherChanges(oldSnapshot, newData) {
  const changes = [];
  
  if (!oldSnapshot) return changes;
  
  // 1. Температура ±5°C
  if (oldSnapshot.temperature !== undefined && newData.temperature !== undefined) {
    const tempDiff = Math.abs(newData.temperature - oldSnapshot.temperature);
    if (tempDiff >= 5) {
      const direction = newData.temperature > oldSnapshot.temperature ? '↑' : '↓';
      changes.push(`Температура ${direction} на ${tempDiff.toFixed(1)}°C`);
    }
  }

  // 2. Категория погоды
  const oldCategory = getWeatherCategory(oldSnapshot.weatherCode);
  const newCategory = getWeatherCategory(newData.weatherCode);
  
  if (oldCategory !== newCategory) {
    if (newCategory === 'гроза') changes.push('⚡ НАЧАЛАСЬ ГРОЗА!');
    else if (newCategory === 'ливень') changes.push('💦 СИЛЬНЫЙ ЛИВЕНЬ');
    else if (newCategory === 'снегопад') changes.push('❄️ СНЕГОПАД');
    else if (oldCategory === 'ясно' && newCategory === 'дождь') changes.push('🌧️ Пошел дождь');
    else if (oldCategory === 'ясно' && newCategory === 'снег') changes.push('❄️ Пошел снег');
    else changes.push(`${oldCategory} → ${newCategory}`);
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
    precipitation: data.rain?.['1h'] || 0,
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