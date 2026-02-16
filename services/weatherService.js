// services/weatherService.js
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;

export async function fetchWeatherWithFallback(lat, lon) {
  console.log(`🌤️ Запрос погоды для: ${lat}, ${lon}`);

  // 1. Пробуем Open-Meteo (основной)
  try {
    const data = await fetchFromOpenMeteo(lat, lon);
    console.log('✅ Open-Meteo успешно');
    return data;
  } catch (error) {
    console.warn('⚠️ Open-Meteo ошибка:', error.message);
  }

  // 2. Пробуем WeatherAPI (фоллбэк) — ТЕПЕРЬ БУДЕТ РАБОТАТЬ!
  try {
    if (WEATHERAPI_KEY) {
      const data = await fetchFromWeatherAPI(lat, lon);
      console.log('✅ WeatherAPI успешно');
      return data;
    } else {
      console.warn('⚠️ WeatherAPI ключ не настроен');
    }
  } catch (error) {
    console.warn('⚠️ WeatherAPI ошибка:', error.message);
  }

  // 3. Заглушка
  console.log('⚠️ Используем заглушку');
  return getFallbackWeather();
}

// Open-Meteo (оставляем как есть)
async function fetchFromOpenMeteo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`);

  const data = await response.json();
  return {
    temperature: data.current_weather.temperature,
    weatherCode: data.current_weather.weathercode,
    precipitation: 0,
    windSpeed: data.current_weather.windspeed,
    source: 'open-meteo'
  };
}

// WeatherAPI (используем твой рабочий ключ)
async function fetchFromWeatherAPI(lat, lon) {
  const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WeatherAPI: ${response.status}`);

  const data = await response.json();
  return {
    temperature: data.current.temp_c,
    weatherCode: convertWeatherAPICode(data.current.condition.code),
    precipitation: data.current.precip_mm || 0,
    windSpeed: data.current.wind_kph / 3.6,
    source: 'weatherapi'
  };
}

function getFallbackWeather() {
  return {
    temperature: 0,
    weatherCode: 3,
    precipitation: 0,
    windSpeed: 2,
    isFallback: true
  };
}

function convertWeatherAPICode(code) {
  const map = {
    1000: 0, 1003: 1, 1006: 2, 1009: 3, 1030: 45, 1063: 61,
    1066: 71, 1087: 95, 1114: 71, 1117: 75, 1135: 45, 1147: 45,
    1150: 51, 1153: 53, 1168: 66, 1171: 67, 1180: 61, 1183: 63,
    1186: 65, 1189: 65, 1192: 82, 1195: 82, 1198: 66, 1201: 67,
    1204: 61, 1207: 61, 1210: 71, 1213: 73, 1216: 75, 1219: 75,
    1222: 86, 1225: 86, 1237: 77, 1240: 61, 1243: 65, 1246: 82,
    1249: 61, 1252: 61, 1255: 71, 1258: 75, 1261: 77, 1264: 77,
    1273: 95, 1276: 99, 1279: 95, 1282: 99
  };
  return map[code] || 3;
}