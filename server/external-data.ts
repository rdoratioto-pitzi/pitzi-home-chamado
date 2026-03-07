/**
 * External Data Service
 * Provides real-time external data fetching capabilities for the Chat IA
 * Currently supports weather data via Open-Meteo API (free, no API key required)
 */

export interface WeatherData {
  location: string;
  temperature: number;
  temperatureUnit: string;
  weatherDescription: string;
  humidity: number;
  windSpeed: number;
  windSpeedUnit: string;
  feelsLike: number;
  uvIndex: number;
  precipitation: number;
  precipitationUnit: string;
  forecast?: string[];
  timestamp: string;
}

export interface ExternalDataResult {
  type: "weather";
  success: boolean;
  data?: WeatherData;
  error?: string;
}

// Brazilian cities coordinates (expandable) - stored in both normalized and original forms
const BRAZILIAN_CITIES: Record<string, { lat: number; lon: number }> = {
  // Normalized names (without accents)
  "sao paulo": { lat: -23.5505, lon: -46.6333 },
  "sp": { lat: -23.5505, lon: -46.6333 },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729 },
  "rj": { lat: -22.9068, lon: -43.1729 },
  "belo horizonte": { lat: -19.9167, lon: -43.9345 },
  "bh": { lat: -19.9167, lon: -43.9345 },
  "brasilia": { lat: -15.8267, lon: -47.9218 },
  "df": { lat: -15.8267, lon: -47.9218 },
  "salvador": { lat: -12.9714, lon: -38.5014 },
  "curitiba": { lat: -25.4284, lon: -49.2733 },
  "fortaleza": { lat: -3.7172, lon: -38.5433 },
  "recife": { lat: -8.0476, lon: -34.8770 },
  "porto alegre": { lat: -30.0346, lon: -51.2177 },
  "manaus": { lat: -3.1190, lon: -60.0217 },
  "campinas": { lat: -22.9099, lon: -47.0626 },
  "goiania": { lat: -16.6799, lon: -49.2550 },
  "vitoria": { lat: -20.3155, lon: -40.3128 },
  "santos": { lat: -23.9608, lon: -46.3336 },
  "rio claro": { lat: -22.4114, lon: -47.5608 },
  "piracicaba": { lat: -22.7253, lon: -47.6492 },
  "limeira": { lat: -22.5647, lon: -47.4019 },
  "americana": { lat: -22.7391, lon: -47.3316 },
  "santa barbara doeste": { lat: -22.7535, lon: -47.4136 },
  "araras": { lat: -22.4714, lon: -47.3849 },
  "louveira": { lat: -23.0868, lon: -46.9504 },
  "vinhedo": { lat: -23.0305, lon: -46.9758 },
  "valinhos": { lat: -22.9706, lon: -46.9758 },
  "itatins": { lat: -24.4214, lon: -47.7888 },
  "registro": { lat: -24.5001, lon: -47.8433 },
  "caxias do sul": { lat: -29.1681, lon: -51.1794 },
  "florianopolis": { lat: -27.5954, lon: -48.5480 },
  "natal": { lat: -5.7945, lon: -35.2110 },
  "maceio": { lat: -9.6658, lon: -35.7353 },
  "joao pessoa": { lat: -7.1195, lon: -34.8450 },
  "teresina": { lat: -5.0892, lon: -42.8019 },
  "campo grande": { lat: -20.4697, lon: -54.6201 },
  "cuiaba": { lat: -15.6014, lon: -56.0979 },
  "belem": { lat: -1.4558, lon: -48.5039 },
  "porto velho": { lat: -8.7619, lon: -63.9039 },
  "boavista": { lat: 2.8235, lon: -60.6758 },
  "macapa": { lat: 0.0389, lon: -51.0664 },
  "rio branco": { lat: -9.9750, lon: -67.8243 },
  "palmas": { lat: -10.1689, lon: -48.3317 },
  "vitoria da conquista": { lat: -14.9448, lon: -40.8385 },
  "uberlandia": { lat: -18.9186, lon: -48.2772 },
  "contagem": { lat: -19.9167, lon: -44.1000 },
  "sao jose dos campos": { lat: -23.2237, lon: -45.9009 },
  "sao jose dos pinhais": { lat: -25.5300, lon: -49.2100 },
  "maringa": { lat: -23.4205, lon: -51.9330 },
  "londrina": { lat: -23.3045, lon: -51.1696 },
  "cascavel": { lat: -24.4711, lon: -53.0522 },
  "petropolis": { lat: -22.5052, lon: -43.1788 },
  "niteroi": { lat: -22.8828, lon: -43.1158 },
};

// Map WMO weather codes to descriptions (Portuguese)
const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Céu limpo",
  1: "Predominantemente limpo",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Nevoeiro",
  51: "Garoa leve",
  53: "Garoa moderada",
  55: "Garoa intensa",
  56: "Garoa congelante leve",
  57: "Garoa congelante intensa",
  61: "Chuva leve",
  63: "Chuva moderada",
  65: "Chuva intensa",
  66: "Chuva congelante leve",
  67: "Chuva congelante intensa",
  71: "Neve leve",
  73: "Neve moderada",
  75: "Neve intensa",
  77: "Grãos de neve",
  80: "Pancadas de chuva leves",
  81: "Pancadas de chuva moderadas",
  82: "Pancadas de chuva intensas",
  85: "Pancadas de neve leves",
  86: "Pancadas de neve intensas",
  95: "Tempestade",
  96: "Tempestade com granizo leve",
  99: "Tempestade com granizo intenso",
};

/**
 * Normalizes city name for lookup
 */
function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Gets coordinates for a city name
 */
function getCityCoordinates(city: string): { lat: number; lon: number } | null {
  const normalized = normalizeCityName(city);
  
  // Direct lookup
  if (BRAZILIAN_CITIES[normalized]) {
    return BRAZILIAN_CITIES[normalized];
  }
  
  // Partial match
  for (const [key, coords] of Object.entries(BRAZILIAN_CITIES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
  return null;
}

/**
 * Checks if a query is requesting weather information
 */
export function isWeatherQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  const weatherKeywords = [
    "tempo",
    "clima",
    "previsão",
    "previsao",
    "temperatura",
    "chuva",
    "sol",
    "nublado",
    "calor",
    "frio",
    "umidade",
    "vento",
    "céu",
    "weather",
    "forecast",
    "precipitação",
    "precipitacao",
    "graus",
    "°c",
    "celsius",
    "humidity",
    "rain",
    "sunny",
    "cloudy",
  ];
  
  return weatherKeywords.some((keyword) => lowerQuery.includes(keyword));
}

/**
 * Extracts location from a weather query
 */
export function extractLocation(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  // Common patterns for location extraction
  const patterns = [
    /tempo\s+(?:em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /clima\s+(?:em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /previsão\s+(?:de|do|da)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /previsao\s+(?:de|do|da)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /temperatura\s+(?:de|do|da|em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /como\s+(?:está|esta|fica)\s+(?:o\s+)?tempo\s+(?:em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /vai\s+chover\s+(?:em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /vai\s+faricar\s+(?:quente|frio)\s+(?:em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    /qual\s+(?:a\s+)?temperatura\s+(?:de|do|da|em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\?|,|$)/i,
    // Portuguese weather query patterns
    /em\s+([a-zA-ZÀ-ÿ]{3,})(?:\s|$|\?|,)/i,
    /no\s+([a-zA-ZÀ-ÿ]{3,})(?:\s|$|\?|,)/i,
    /na\s+([a-zA-ZÀ-ÿ]{3,})(?:\s|$|\?|,)/i,
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();
      if (location.length >= 2) {
        return location;
      }
    }
  }
  
  // Check if any known city is mentioned in the query
  for (const city of Object.keys(BRAZILIAN_CITIES)) {
    if (lowerQuery.includes(city)) {
      return city;
    }
  }
  
  return null;
}

/**
 * Fetches weather data from Open-Meteo API
 */
export async function fetchWeatherData(location: string): Promise<ExternalDataResult> {
  try {
    const coords = getCityCoordinates(location);
    
    if (!coords) {
      return {
        type: "weather",
        success: false,
        error: `Localização "${location}" não encontrada. Tente usar uma cidade brasileira conhecida ou o nome em português.`,
      };
    }

    const { lat, lon } = coords;
    
    // Open-Meteo API endpoint
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index&timezone=auto&forecast_days=7`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.current) {
      throw new Error("Invalid weather data response");
    }
    
    const weatherCode = data.current.weather_code ?? 0;
    const weatherDescription = WEATHER_DESCRIPTIONS[weatherCode] || "Desconhecido";
    
    // Get 7-day forecast if available
    const forecast: string[] = [];
    if (data.daily && data.daily.time) {
      for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        const day = data.daily.time[i];
        const maxTemp = data.daily.temperature_2m_max?.[i];
        const minTemp = data.daily.temperature_2m_min?.[i];
        const dayCode = data.daily.weather_code?.[i];
        const dayDesc = WEATHER_DESCRIPTIONS[dayCode] || "";
        
        if (day && maxTemp !== undefined && minTemp !== undefined) {
          const date = new Date(day);
          const dayName = date.toLocaleDateString("pt-BR", { weekday: "short" });
          forecast.push(`${dayName}: ${minTemp.toFixed(0)}° - ${maxTemp.toFixed(0)}° ${dayDesc}`);
        }
      }
    }
    
    const weatherData: WeatherData = {
      location: location.charAt(0).toUpperCase() + location.slice(1),
      temperature: data.current.temperature_2m,
      temperatureUnit: "°C",
      weatherDescription,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      windSpeedUnit: "km/h",
      feelsLike: data.current.apparent_temperature,
      uvIndex: data.current.uv_index ?? 0,
      precipitation: data.current.precipitation,
      precipitationUnit: "mm",
      forecast: forecast.length > 0 ? forecast : undefined,
      timestamp: new Date().toISOString(),
    };
    
    return {
      type: "weather",
      success: true,
      data: weatherData,
    };
    
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return {
      type: "weather",
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao buscar dados do clima",
    };
  }
}

/**
 * Main function to handle external data queries
 * Returns formatted context for the AI to use
 */
export async function getExternalDataContext(query: string): Promise<string | null> {
  // Check if it's a weather query
  if (isWeatherQuery(query)) {
    const location = extractLocation(query);
    
    if (!location) {
      return "O usuário está perguntando sobre o tempo/clima, mas não especificou uma localização. Peça ao usuário para especificar uma cidade.";
    }
    
    const result = await fetchWeatherData(location);
    
    if (!result.success) {
      return `Não foi possível obter informações climáticas: ${result.error}`;
    }
    
    if (!result.data) {
      return "Não foi possível obter dados climáticos.";
    }
    
    const { data } = result;
    
    let context = `DADOS CLIMÁTICOS ATUAIS PARA ${data.location.toUpperCase()}:\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `🌡️ Temperatura atual: ${data.temperature}${data.temperatureUnit} (sensação térmica: ${data.feelsLike}${data.temperatureUnit})\n`;
    context += `☁️ Condição: ${data.weatherDescription}\n`;
    context += `💧 Umidade: ${data.humidity}%\n`;
    context += `🌬️ Vento: ${data.windSpeed} ${data.windSpeedUnit}\n`;
    context += `☀️ Índice UV: ${data.uvIndex}\n`;
    context += `🌧️ Precipitação: ${data.precipitation} ${data.precipitationUnit}\n`;
    
    if (data.forecast && data.forecast.length > 0) {
      context += `\n📅 PREVISÃO PRÓXIMOS DIAS:\n`;
      for (const day of data.forecast) {
        context += `  • ${day}\n`;
      }
    }
    
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `Fonte: Open-Meteo (dados atualizados em ${new Date(data.timestamp).toLocaleString("pt-BR")})\n`;
    
    return context;
  }
  
  return null;
}

/**
 * Determines if a query needs external data
 */
export function needsExternalData(query: string): boolean {
  return isWeatherQuery(query);
}
