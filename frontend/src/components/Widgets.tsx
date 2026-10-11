import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react';
import type { WeatherInfo } from '../services/api';

export function WeatherWidget({ weather, city }: { weather: WeatherInfo | null; city: string }) {
  const condition = weather?.weather1 || '';
  const Icon = condition.includes('雷') ? CloudLightning : condition.includes('雪') ? CloudSnow : condition.includes('雨') ? CloudRain : condition.includes('阴') ? Cloud : condition.includes('云') ? CloudSun : Sun;
  const temperature = weather && Number.isFinite(weather.temperature) ? Math.round(weather.temperature) : null;
  return <div className="daily-weather">
    <div className="daily-weather-reading"><Icon size={30} strokeWidth={1.5} aria-hidden="true" /><span>{temperature === null ? '—' : temperature}<small>°C</small></span></div>
    <p>{weather?.place || city}<span>·</span>{condition || '加载中'}</p>
  </div>;
}

export const ClockWidget = () => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="clock-widget flex flex-col items-center text-white drop-shadow-2xl mb-12 select-none">
      <div className="clock-time text-8xl md:text-[8rem] font-medium tracking-tight leading-none drop-shadow-lg">
        {format(time, 'HH:mm')}
      </div>
      <p className="text-xl md:text-2xl font-medium mt-4 opacity-90 tracking-wide drop-shadow-md">
        {format(time, 'MMMMdo EEEE', { locale: zhCN })}
      </p>
    </div>
  );
};
