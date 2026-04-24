/** 天气展示用的省、市、adcode（与后端 /api/weather 查询参数一致） */

export const DEFAULT_WEATHER_LOCATION = {
  province: '广东',
  city: '深圳',
  adcode: '440300',
} as const;

export type WeatherLocation = {
  province: string;
  city: string;
  adcode: string;
};

const STORAGE_KEY = 'navihub_weather_location';

export function readWeatherLocationFromStorage(): WeatherLocation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEATHER_LOCATION };
    const parsed = JSON.parse(raw) as Partial<WeatherLocation>;
    const province =
      typeof parsed.province === 'string' && parsed.province.trim() !== ''
        ? parsed.province.trim()
        : DEFAULT_WEATHER_LOCATION.province;
    const city =
      typeof parsed.city === 'string' && parsed.city.trim() !== ''
        ? parsed.city.trim()
        : DEFAULT_WEATHER_LOCATION.city;
    const adcode =
      typeof parsed.adcode === 'string' ? parsed.adcode.trim() : DEFAULT_WEATHER_LOCATION.adcode;
    return { province, city, adcode };
  } catch {
    return { ...DEFAULT_WEATHER_LOCATION };
  }
}

export function writeWeatherLocationToStorage(loc: WeatherLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // ignore
  }
}
