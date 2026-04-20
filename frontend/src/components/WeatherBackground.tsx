import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Cloud, CloudRain, CloudSnow, Sun, CloudLightning, Moon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const WeatherBackground = () => {
  const { currentWeather } = useAppContext();
  const [currentTime, setCurrentTime] = useState(new Date());

  // 每一分钟更新一次时间状态，触发太阳/月亮位置计算
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const weatherType = currentWeather?.weather1 || '晴';

  const isRain = weatherType.includes('雨');
  // 严格区分多云和阴天，阴天气压更低、云层更厚更暗
  const isOvercast = weatherType.includes('阴');
  const isCloudy = weatherType.includes('云') || isOvercast;
  const isSnow = weatherType.includes('雪');
  const isThunder = weatherType.includes('雷');
  const isClear = !isRain && !isCloudy && !isSnow && !isThunder;

  // 根据当前系统时间计算天体（太阳/月亮）的位置和日夜交替逻辑
  const currentDecimalHour = currentTime.getHours() + currentTime.getMinutes() / 60;
  
  const isDayTime = currentDecimalHour >= 6 && currentDecimalHour < 19;
  const isNight = !isDayTime;
  const isDawn = currentDecimalHour >= 5 && currentDecimalHour < 8;
  const isSunset = currentDecimalHour >= 17 && currentDecimalHour < 19;

  // celestialProgress: 0 表示刚升起，0.5 表示处于最高点，1 表示准备降落
  let celestialProgress = 0;
  if (isDayTime) {
    celestialProgress = (currentDecimalHour - 6) / 13; // 白天：早6点到晚19点
  } else {
    const elapsed = currentDecimalHour >= 19 ? currentDecimalHour - 19 : currentDecimalHour + 5;
    celestialProgress = elapsed / 11; // 夜间：晚19点到早6点
  }

  // 利用抛物线计算 X 和 Y 坐标，形成自然升落圆弧
  const celestialLeft = `calc(10vw + ${celestialProgress * 80}vw)`;
  const celestialYFactor = 4 * Math.pow(celestialProgress - 0.5, 2);
  const celestialTop = `calc(10vh + ${celestialYFactor * 60}vh)`;

  // 对于恶劣天气或厚重阴天，天体（太阳/月亮）应被彻底遮挡，多云的天气则若隐若现（Opacity 变低）
  const celestialOpacity = (isRain || isSnow || isThunder || isOvercast) ? 'opacity-0' : (isCloudy ? 'opacity-30 mix-blend-screen' : 'opacity-100');

  // 根据时间调整天气效果的透明度（夜晚天气效果更暗）
  const weatherOpacity = isNight ? 'opacity-60' : 'opacity-90';

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-slate-900 transition-colors duration-1000 pointer-events-none">
      
      {/* ===== 时间背景（始终显示，不受天气影响） ===== */}
      {/* 黎明（5-8点） */}
      <div className={cn("absolute inset-0 transition-opacity duration-1000 ease-in-out", isDawn ? "opacity-100" : "opacity-0", "bg-gradient-to-b from-indigo-400 via-pink-300 to-orange-200")} />
      {/* 白天（8-17点） */}
      <div className={cn("absolute inset-0 transition-opacity duration-1000 ease-in-out", isDayTime && !isDawn && !isSunset ? "opacity-100" : "opacity-0", "bg-gradient-to-b from-blue-400 to-blue-200")} />
      {/* 黄昏（17-19点） */}
      <div className={cn("absolute inset-0 transition-opacity duration-1000 ease-in-out", isSunset ? "opacity-100" : "opacity-0", "bg-gradient-to-b from-blue-500 via-orange-400 to-red-400")} />
      {/* 夜晚（19-5点） */}
      <div className={cn("absolute inset-0 transition-opacity duration-1000 ease-in-out", isNight ? "opacity-100" : "opacity-0", "bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900")} />

      {/* ===== 核心：时间动态天体（太阳/月亮），随着时间自动变化轨迹 ===== */}
      <div 
        className={cn("absolute transition-all duration-1000 ease-in-out", celestialOpacity)}
        style={{ left: celestialLeft, top: celestialTop, transform: 'translate(-50%, -50%)' }}
      >
        {isDayTime ? (
          <div className="relative animate-pulse-slow">
             {/* 太阳在早晚是橘色，正午是明黄色 */}
             <div className={cn("w-32 h-32 rounded-full blur-xl opacity-80", isDawn || isSunset ? "bg-orange-400" : "bg-yellow-300")} />
             <div className={cn("absolute inset-0 w-32 h-32 rounded-full blur-md opacity-90 animate-spin-slow flex items-center justify-center", isDawn || isSunset ? "bg-orange-300" : "bg-yellow-200")}>
               <Sun size={64} className={isDawn || isSunset ? "text-orange-500" : "text-yellow-500"} />
             </div>
          </div>
        ) : (
          <div className="relative animate-pulse-slow">
             {/* 晚上显示月亮发光 */}
             <div className="w-32 h-32 bg-slate-100 rounded-full blur-xl opacity-30" />
             <div className="absolute inset-0 w-32 h-32 bg-slate-200 rounded-full blur-md opacity-80 flex items-center justify-center">
               <Moon size={64} className="text-slate-100" />
             </div>
          </div>
        )}
      </div>

      {/* ===== 天气效果图标层（叠加在时间背景之上） ===== */}
      
      {/* 晴天 - 显示光芒效果 */}
      {isClear && (
        <div className={cn("absolute inset-0 pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
          <div className="absolute top-20 right-20 w-64 h-64 bg-yellow-300/20 rounded-full blur-3xl animate-pulse-slow" />
        </div>
      )}

      {/* 多云 - 显示白色/灰色移动云朵 */}
      {(isCloudy && !isRain && !isSnow && !isThunder) && (
        <div className={cn("absolute inset-x-0 top-0 h-80 overflow-hidden pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           <Cloud size={140} className={cn("absolute top-8 animate-cloud-slow -left-40", isOvercast ? "text-slate-400/70" : "text-white/60")} />
           <Cloud size={180} className={cn("absolute top-2 animate-cloud-medium -left-56", isOvercast ? "text-slate-500/80" : "text-white/40")} style={{ animationDelay: '2s' }} />
           <Cloud size={120} className={cn("absolute top-24 animate-cloud-fast -left-32", isOvercast ? "text-slate-600/70" : "text-white/50")} style={{ animationDelay: '5s' }} />
           <Cloud size={100} className={cn("absolute top-16 animate-cloud-slow -left-24", isOvercast ? "text-slate-400/60" : "text-white/30")} style={{ animationDelay: '8s' }} />
        </div>
      )}

      {/* 暴雨/雷暴 - 显示乌黑浓密云层 + 闪电 */}
      {(isRain || isThunder) && (
        <div className={cn("absolute inset-x-0 top-0 h-96 overflow-hidden pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           {/* 乌黑暴雨云层 */}
           <Cloud size={200} className="absolute top-0 animate-cloud-slow -left-48 text-slate-800/90" />
           <Cloud size={240} className="absolute top-4 animate-cloud-medium -left-64 text-slate-900/95" style={{ animationDelay: '1s' }} />
           <Cloud size={180} className="absolute top-12 animate-cloud-fast -left-40 text-slate-800/85" style={{ animationDelay: '3s' }} />
           <Cloud size={160} className="absolute top-8 animate-cloud-slow -left-32 text-slate-900/90" style={{ animationDelay: '6s' }} />
           <Cloud size={140} className="absolute top-20 animate-cloud-medium -left-28 text-slate-800/80" style={{ animationDelay: '9s' }} />
           {/* 雷暴闪电效果 */}
           {isThunder && (
             <>
               <div className="absolute top-10 left-1/4 w-1 h-32 bg-yellow-200/80 rotate-12 animate-flash" style={{ animationDelay: '0s' }} />
               <div className="absolute top-20 left-1/3 w-0.5 h-24 bg-yellow-100/60 -rotate-6 animate-flash" style={{ animationDelay: '2.5s' }} />
               <div className="absolute top-5 left-2/3 w-1 h-40 bg-yellow-200/70 rotate-6 animate-flash" style={{ animationDelay: '5s' }} />
             </>
           )}
        </div>
      )}

      {/* 雨天 - 显示乌云图标 + 雨滴 */}
      {isRain && (
        <div className={cn("absolute inset-0 pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           {/* 雨天云层图标 */}
           <div className="absolute inset-x-0 top-0 h-80 overflow-hidden">
              <CloudRain size={160} className="absolute top-4 animate-cloud-slow -left-40 text-slate-500/80" />
              <CloudRain size={200} className="absolute top-8 animate-cloud-medium -left-56 text-slate-600/90" style={{ animationDelay: '2s' }} />
              <CloudRain size={140} className="absolute top-16 animate-cloud-fast -left-32 text-slate-500/70" style={{ animationDelay: '5s' }} />
           </div>
           {/* 雨滴动画 */}
           <div className="absolute inset-0 overflow-hidden opacity-50">
             {Array.from({ length: 60 }).map((_, i) => (
               <div 
                 key={i} 
                 className="absolute bg-blue-200/60 w-0.5 rounded-full animate-rain"
                 style={{
                   left: `${Math.random() * 100}%`,
                   top: `-${Math.random() * 20 + 10}px`,
                   height: `${Math.random() * 20 + 20}px`,
                   animationDelay: `${Math.random() * 2}s`,
                   animationDuration: `${Math.random() * 0.5 + 0.5}s`
                 }}
               />
             ))}
           </div>
        </div>
      )}

      {/* 雪天 - 显示雪花图标 + 雪花飘落 */}
      {isSnow && (
        <div className={cn("absolute inset-0 pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           {/* 雪天云层 */}
           <div className="absolute inset-x-0 top-0 h-80 overflow-hidden">
              <CloudSnow size={160} className="absolute top-4 animate-cloud-slow -left-40 text-blue-100/70" />
              <CloudSnow size={200} className="absolute top-8 animate-cloud-medium -left-56 text-white/60" style={{ animationDelay: '2s' }} />
              <CloudSnow size={140} className="absolute top-16 animate-cloud-fast -left-32 text-blue-50/80" style={{ animationDelay: '5s' }} />
           </div>
           {/* 雪花飘落 */}
           <div className="absolute inset-0 overflow-hidden opacity-80">
             {Array.from({ length: 50 }).map((_, i) => (
               <div 
                 key={i} 
                 className="absolute bg-white rounded-full animate-snow"
                 style={{
                   left: `${Math.random() * 100}%`,
                   top: `-10px`,
                   width: `${Math.random() * 6 + 4}px`,
                   height: `${Math.random() * 6 + 4}px`,
                   animationDelay: `${Math.random() * 5}s`,
                   animationDuration: `${Math.random() * 3 + 3}s`
                 }}
               />
             ))}
           </div>
        </div>
      )}

      {/* 极轻压暗背景，仅在登录后保持文字清晰。数值过高会让半透明卡片（backdrop-blur）显得模糊 */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/[0.015] via-transparent to-black/[0.04]" />
    </div>
  );
};
