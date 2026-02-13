// pixel-weather-server/services/weatherService.js

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY; // Тоже добавим!

/**
 * Получает погоду с ФОЛЛБЭКОМ как на клиенте
 * 1. OpenWeatherMap (основной)
 * 2. WeatherAPI.com (фоллбэк)
 * 3. Заглушка (последний шанс)
 */
export async function fetchWeatherWithFallback(lat, lon) {
  console.log(`🌤️ Запрос погоды для: ${lat}, ${lon}`);
  
  // 1. Пробуем OpenWeatherMap
  try {
    if (OPENWEATHER_API_KEY) {
      const data = await fetchFromOpenWeather(lat, lon);
      console.log('✅ OpenWeatherMap успешно');
      return data;
    }
  } catch (error) {
    console.warn('⚠️ OpenWeatherMap ошибка:', error.message);
  }
  
  // 2. Пробуем WeatherAPI.com
  try {
    if (WEATHERAPI_KEY) {
      const data = await fetchFromWeatherAPI(lat, lon);
      console.log('✅ WeatherAPI.com успешно (фоллбэк)');
      return data;
    }
  } catch (error) {
    console.warn('⚠️ WeatherAPI.com ошибка:', error.message);
  }
  
  // 3. ФИНАЛЬНЫЙ ФОЛЛБЭК: возвращаем "нормальную" погоду
  console.log('⚠️ Оба API недоступны, используем заглушку');
  return {
    temperature: 0,
    weatherCode: 3, // пасмурно
    precipitation: 0,
    windSpeed: 2,
    isFallback: true
  };
}

/**
 * OpenWeatherMap
 */
async function fetchFromOpenWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenWeather: ${response.status}`);
  
  const data = await response.json();
  
  return {
    temperature: data.main.temp,
    weatherCode: convertOpenWeatherCode(data.weather[0].id),
    precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
    windSpeed: data.wind.speed,
    source: 'openweather'
  };
}

/**
 * WeatherAPI.com (фоллбэк)
 */
async function fetchFromWeatherAPI(lat, lon) {
  const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WeatherAPI: ${response.status}`);
  
  const data = await response.json();
  
  return {
    temperature: data.current.temp_c,
    weatherCode: convertWeatherAPICode(data.current.condition.code),
    precipitation: data.current.precip_mm || 0,
    windSpeed: data.current.wind_kph / 3.6, // км/ч → м/с
    source: 'weatherapi'
  };
}

/**
 * Конвертер OpenWeatherMap code → WMO
 */
function convertOpenWeatherCode(code) {
  if (code >= 200 && code < 300) return 95; // Гроза
  if (code >= 300 && code < 400) return 51; // Морось
  if (code >= 500 && code < 600) return 61; // Дождь
  if (code >= 600 && code < 700) return 71; // Снег
  if (code >= 700 && code < 800) return 45; // Туман
  if (code === 800) return 0; // Ясно
  if (code === 801) return 1;
  if (code === 802) return 2;
  if (code === 803 || code === 804) return 3;
  return 3;
}

/**
 * Конвертер WeatherAPI code → WMO
 */
function convertWeatherAPICode(code) {
  const map = {
    1000: 0, // Ясно
    1003: 1, // Переменная облачность
    1006: 2, // Облачно
    1009: 3, // Пасмурно
    1030: 45, // Туман
    1063: 61, // Дождь
    1066: 71, // Снег
    1069: 61, // Мокрый снег
    1072: 51, // Морось
    1087: 95, // Гроза
    1114: 71, // Снегопад
    1117: 75, // Сильный снегопад
    1135: 45, // Туман
    1147: 45, // Сильный туман
    1150: 51, // Легкая морось
    1153: 53, // Морось
    1168: 66, // Ледяной дождь
    1171: 67, // Сильный ледяной дождь
    1180: 61, // Небольшой дождь
    1183: 63, // Дождь
    1186: 65, // Сильный дождь
    1189: 65, // Сильный дождь
    1192: 82, // Ливень
    1195: 82, // Сильный ливень
    1198: 66, // Ледяной дождь
    1201: 67, // Сильный ледяной дождь
    1204: 61, // Мокрый снег
    1207: 61, // Мокрый снег
    1210: 71, // Небольшой снег
    1213: 73, // Снег
    1216: 75, // Сильный снег
    1219: 75, // Сильный снег
    1222: 86, // Снегопад
    1225: 86, // Сильный снегопад
    1237: 77, // Снежные зерна
    1240: 61, // Дождь
    1243: 65, // Сильный дождь
    1246: 82, // Ливень
    1249: 61, // Мокрый снег
    1252: 61, // Мокрый снег
    1255: 71, // Небольшой снег
    1258: 75, // Сильный снег
    1261: 77, // Снежные зерна
    1264: 77, // Снежные зерна
    1273: 95, // Гроза с дождем
    1276: 99, // Сильная гроза
    1279: 95, // Гроза со снегом
    1282: 99, // Сильная гроза со снегом
  };
  return map[code] || 3;
}

export default {
  fetchWeatherWithFallback,
  fetchFromOpenWeather,
  fetchFromWeatherAPI
};