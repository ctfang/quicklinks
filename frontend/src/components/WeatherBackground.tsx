import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

interface RealisticCloudProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'white' | 'gray' | 'dark';
  breatheDelay?: number;
}

// 写实太阳组件
const RealisticSun: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative w-32 h-32 ${className}`}>
      {/* 第4层 - 最外层大气散射光晕（超大、超淡） */}
      <div 
        className="absolute rounded-full bg-yellow-50/10 blur-3xl animate-pulse-slow"
        style={{ 
          width: '200%', 
          height: '200%', 
          top: '-50%', 
          left: '-50%',
          animationDelay: '0s',
          animationDuration: '6s'
        }} 
      />
      {/* 第3层 - 大圆光晕 */}
      <div 
        className="absolute rounded-full bg-orange-100/20 blur-2xl animate-pulse-slow"
        style={{ 
          width: '160%', 
          height: '160%', 
          top: '-30%', 
          left: '-30%',
          animationDelay: '0.5s',
          animationDuration: '5s'
        }} 
      />
      {/* 第2层 - 中圆光晕 */}
      <div 
        className="absolute rounded-full bg-yellow-100/40 blur-xl animate-pulse-slow"
        style={{ 
          width: '120%', 
          height: '120%', 
          top: '-10%', 
          left: '-10%',
          animationDelay: '1s',
          animationDuration: '4s'
        }} 
      />
      {/* 第1层 - 紧贴太阳的小圆光晕 */}
      <div 
        className="absolute rounded-full bg-yellow-200/60 blur-md animate-pulse-slow"
        style={{ 
          width: '90%', 
          height: '90%', 
          top: '5%', 
          left: '5%',
          animationDelay: '1.5s',
          animationDuration: '3.5s'
        }} 
      />
      
      {/* 光芒射线 - 使用 conic-gradient 创建 */}
      <div 
        className="absolute inset-0 animate-spin-slow opacity-60"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255, 255, 255, 0.1) 5deg, transparent 10deg, transparent 35deg, rgba(255, 255, 200, 0.15) 40deg, transparent 45deg, transparent 80deg, rgba(255, 255, 255, 0.08) 85deg, transparent 90deg, transparent 125deg, rgba(255, 255, 200, 0.12) 130deg, transparent 135deg, transparent 170deg, rgba(255, 255, 255, 0.1) 175deg, transparent 180deg, transparent 215deg, rgba(255, 255, 200, 0.08) 220deg, transparent 225deg, transparent 260deg, rgba(255, 255, 255, 0.12) 265deg, transparent 270deg, transparent 305deg, rgba(255, 255, 200, 0.1) 310deg, transparent 315deg, transparent 350deg, rgba(255, 255, 255, 0.08) 355deg, transparent 360deg)',
          filter: 'blur(1px)'
        }}
      />
      
      {/* 太阳本体 - 径向渐变核心发光体 */}
      <div 
        className="absolute inset-2 rounded-full animate-pulse-slow"
        style={{
          background: 'radial-gradient(circle, white 0%, #fef08a 20%, #fbbf24 50%, #f59e0b 75%, transparent 100%)',
          boxShadow: '0 0 30px 8px rgba(251, 191, 36, 0.5), 0 0 60px 15px rgba(251, 191, 36, 0.3), 0 0 100px 25px rgba(245, 158, 11, 0.15)',
          animationDuration: '4s'
        }}
      />
    </div>
  );
};

// 写实月亮组件
const RealisticMoon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative w-32 h-32 ${className}`}>
      {/* 月光光晕 */}
      <div className="absolute -inset-4 rounded-full bg-yellow-100/15 blur-xl animate-pulse-slow" />
      <div className="absolute -inset-2 rounded-full bg-yellow-50/20 blur-lg animate-pulse-slow" />

      {/* 月亮本体 - 使用两个重叠圆形形成自然月牙 */}
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #fefce8 0%, #e2e8f0 50%, #94a3b8 100%)',
          boxShadow: '0 0 40px 8px rgba(254, 252, 232, 0.2), inset -8px -8px 16px rgba(0,0,0,0.08)'
        }}
      >
        {/* 月球环形山 */}
        <div className="absolute w-2 h-2 rounded-full bg-slate-400/30 top-4 left-5" />
        <div className="absolute w-1.5 h-1.5 rounded-full bg-slate-400/25 top-8 right-6" />
        <div className="absolute w-1 h-1 rounded-full bg-slate-400/28 bottom-5 left-8" />
        <div className="absolute w-1.5 h-1.5 rounded-full bg-slate-400/20 top-5 right-4" />
      </div>

      {/* 遮罩圆 - 与夜空同色，偏移形成月牙边缘 */}
      <div
        className="absolute rounded-full"
        style={{
          width: '112px',
          height: '112px',
          background: '#0f172a',
          top: '-8px',
          right: '-16px',
          boxShadow: '0 0 24px 4px rgba(15, 23, 42, 0.6)'
        }}
      />
    </div>
  );
};

// 写实云朵组件
const RealisticCloud: React.FC<RealisticCloudProps> = ({ 
  size = 150, 
  className = '', 
  style, 
  variant = 'white',
  breatheDelay = 0
}) => {
  const colors = {
    white: { 
      main: 'bg-white/80', 
      shadow: 'bg-slate-100/70',
      dropShadow: 'drop-shadow(0 6px 8px rgba(100, 116, 139, 0.15))'
    },
    gray: { 
      main: 'bg-slate-300/85', 
      shadow: 'bg-slate-400/70',
      dropShadow: 'drop-shadow(0 6px 8px rgba(71, 85, 105, 0.2))'
    },
    dark: { 
      main: 'bg-slate-700/90', 
      shadow: 'bg-slate-800/80',
      dropShadow: 'drop-shadow(0 8px 12px rgba(30, 41, 59, 0.4))'
    },
  };
  const color = colors[variant];
  
  return (
    <div 
      className={`relative ${className}`} 
      style={{ 
        width: size * 1.8, 
        height: size, 
        filter: color.dropShadow,
        ...style 
      }}
    >
      {/* 云朵主体 - 写实自然风格，带模糊效果 */}
      <div 
        className={`absolute rounded-full ${color.main} blur-sm animate-[cloud-breathe_8s_ease-in-out_infinite]`}
        style={{ 
          width: size * 0.75, 
          height: size * 0.6, 
          left: size * 0.55, 
          top: size * 0.2,
          animationDelay: `${breatheDelay}s`
        }} 
      />
      <div 
        className={`absolute rounded-full ${color.main} blur-sm animate-[cloud-breathe_10s_ease-in-out_infinite]`}
        style={{ 
          width: size * 0.6, 
          height: size * 0.5, 
          left: size * 0.12, 
          top: size * 0.35,
          animationDelay: `${breatheDelay + 1.2}s`
        }} 
      />
      <div 
        className={`absolute rounded-full ${color.main} blur-sm animate-[cloud-breathe_9s_ease-in-out_infinite]`}
        style={{ 
          width: size * 0.7, 
          height: size * 0.55, 
          left: size * 0.9, 
          top: size * 0.28,
          animationDelay: `${breatheDelay + 2.5}s`
        }} 
      />
      <div 
        className={`absolute rounded-full ${color.shadow} blur-sm animate-[cloud-breathe_8s_ease-in-out_infinite]`}
        style={{ 
          width: size * 1.25, 
          height: size * 0.5, 
          left: size * 0.28, 
          top: size * 0.4,
          animationDelay: `${breatheDelay + 0.7}s`
        }} 
      />
      {/* 顶部高光 */}
      <div 
        className={`absolute rounded-full ${color.shadow} blur-sm animate-[cloud-breathe_7s_ease-in-out_infinite]`}
        style={{ 
          width: size * 0.5, 
          height: size * 0.4, 
          left: size * 0.65, 
          top: size * 0.08,
          animationDelay: `${breatheDelay + 1.8}s`
        }} 
      />
    </div>
  );
};

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
          <RealisticSun className={isDawn || isSunset ? "scale-90" : "scale-100"} />
        ) : (
          <RealisticMoon />
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
        <div className={cn("absolute inset-x-0 top-0 h-80 pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           <RealisticCloud size={140} variant={isOvercast ? 'gray' : 'white'} className="absolute top-8 animate-cloud-slow left-0" style={{ animationDelay: '-8s' }} breatheDelay={0} />
           <RealisticCloud size={180} variant={isOvercast ? 'gray' : 'white'} className="absolute top-2 animate-cloud-medium left-0" style={{ animationDelay: '-22s' }} breatheDelay={2} />
           <RealisticCloud size={120} variant={isOvercast ? 'gray' : 'white'} className="absolute top-24 animate-cloud-fast left-0" style={{ animationDelay: '-12s' }} breatheDelay={4} />
           <RealisticCloud size={100} variant={isOvercast ? 'gray' : 'white'} className="absolute top-16 animate-cloud-slow left-0" style={{ animationDelay: '-38s' }} breatheDelay={1} />
        </div>
      )}

      {/* 暴雨/雷暴 - 显示乌黑浓密云层 + 闪电 */}
      {(isRain || isThunder) && (
        <div className={cn("absolute inset-x-0 top-0 h-96 pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           {/* 乌黑暴雨云层 - z-0 底层 */}
           <RealisticCloud size={200} variant="dark" className="absolute top-0 animate-cloud-slow left-0 z-0" style={{ animationDelay: '-10s' }} breatheDelay={0} />
           <RealisticCloud size={240} variant="dark" className="absolute top-4 animate-cloud-medium left-0 z-0" style={{ animationDelay: '-25s' }} breatheDelay={3} />
           <RealisticCloud size={180} variant="dark" className="absolute top-12 animate-cloud-fast left-0 z-0" style={{ animationDelay: '-15s' }} breatheDelay={1} />
           <RealisticCloud size={160} variant="dark" className="absolute top-8 animate-cloud-slow left-0 z-0" style={{ animationDelay: '-35s' }} breatheDelay={2} />
           <RealisticCloud size={140} variant="dark" className="absolute top-20 animate-cloud-medium left-0 z-0" style={{ animationDelay: '-5s' }} breatheDelay={4} />
           {/* 雷暴闪电效果 - 写实风格 SVG 闪电 */}
           {isThunder && (
             <>
               {/* 闪电照亮效果 - 云层区域短暂变亮 */}
               <div 
                 className="absolute inset-0 animate-flash pointer-events-none"
                 style={{ 
                   background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, transparent 100%)',
                   animationDelay: '0.1s'
                 }} 
               />
               
               {/* 主闪电 1 - 更粗更长，有分叉 */}
               <div className="absolute top-6 left-1/4 animate-flash" style={{ animationDelay: '0s' }}>
                 <svg 
                   viewBox="0 0 60 180" 
                   className="w-14 h-40"
                   style={{ filter: 'drop-shadow(0 0 10px rgba(147, 197, 253, 0.9)) drop-shadow(0 0 20px rgba(59, 130, 246, 0.6))' }}
                 >
                   {/* 主分支 */}
                   <path 
                     d="M32,0 L20,55 L28,52 L15,95 L25,90 L8,140 L22,130 L12,180 L35,110 L25,115 L42,65 L32,70 L48,25 Z" 
                     fill="white" 
                     opacity="0.95"
                   />
                   {/* 小分叉 1 */}
                   <path 
                     d="M28,52 L38,58 L32,70" 
                     fill="white" 
                     opacity="0.7"
                   />
                   {/* 小分叉 2 */}
                   <path 
                     d="M15,95 L5,105 L8,120" 
                     fill="white" 
                     opacity="0.6"
                   />
                 </svg>
               </div>
               
               {/* 次闪电 2 - 更细更短 */}
               <div className="absolute top-20 left-1/3 animate-flash" style={{ animationDelay: '1.8s' }}>
                 <svg 
                   viewBox="0 0 40 120" 
                   className="w-8 h-28"
                   style={{ filter: 'drop-shadow(0 0 6px rgba(147, 197, 253, 0.8)) drop-shadow(0 0 12px rgba(59, 130, 246, 0.5))' }}
                 >
                   <path 
                     d="M22,0 L12,40 L20,38 L8,85 L18,80 L5,120 L28,70 L18,75 L32,35 L22,38 L35,8 Z" 
                     fill="white" 
                     opacity="0.85"
                   />
                 </svg>
               </div>
               
               {/* 主闪电 3 - 不同形状，较长 */}
               <div className="absolute top-4 left-2/3 animate-flash" style={{ animationDelay: '3.5s' }}>
                 <svg 
                   viewBox="0 0 50 160" 
                   className="w-12 h-36"
                   style={{ filter: 'drop-shadow(0 0 12px rgba(147, 197, 253, 0.9)) drop-shadow(0 0 24px rgba(59, 130, 246, 0.6))' }}
                 >
                   {/* 主分支 */}
                   <path 
                     d="M28,0 L18,48 L26,45 L12,88 L22,82 L6,130 L20,120 L10,160 L32,100 L22,105 L40,55 L30,60 L45,18 Z" 
                     fill="white" 
                     opacity="0.9"
                   />
                   {/* 分叉 */}
                   <path 
                     d="M22,82 L32,92 L28,105" 
                     fill="white" 
                     opacity="0.65"
                   />
                 </svg>
               </div>
               
               {/* 远处细闪电 4 - 很细很短，背景感 */}
               <div className="absolute top-32 left-3/4 animate-flash" style={{ animationDelay: '5.2s' }}>
                 <svg 
                   viewBox="0 0 30 80" 
                   className="w-5 h-20"
                   style={{ filter: 'drop-shadow(0 0 4px rgba(147, 197, 253, 0.6))' }}
                 >
                   <path 
                     d="M16,0 L8,32 L15,30 L5,65 L14,60 L8,80 L22,50 L14,55 L20,25 L12,28 L22,5 Z" 
                     fill="white" 
                     opacity="0.6"
                   />
                 </svg>
               </div>
               
               {/* 远处细闪电 5 */}
               <div className="absolute top-16 left-1/6 animate-flash" style={{ animationDelay: '4.1s' }}>
                 <svg 
                   viewBox="0 0 35 100" 
                   className="w-6 h-24"
                   style={{ filter: 'drop-shadow(0 0 5px rgba(147, 197, 253, 0.7))' }}
                 >
                   <path 
                     d="M20,0 L10,38 L18,35 L6,78 L16,72 L5,100 L24,65 L14,70 L28,28 L18,32 L32,10 Z" 
                     fill="white" 
                     opacity="0.7"
                   />
                 </svg>
               </div>
             </>
           )}
        </div>
      )}

      {/* 雨天 - 显示乌云图标 + 雨滴 */}
      {isRain && (
        <div className={cn("absolute inset-0 pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           {/* 雨天云层图标 - z-10 显示在黑色云层上方 */}
           <div className="absolute inset-x-0 top-0 h-80">
              <RealisticCloud size={160} variant="gray" className="absolute top-4 animate-cloud-slow left-0 z-10" style={{ animationDelay: '-6s' }} breatheDelay={0} />
              <RealisticCloud size={200} variant="gray" className="absolute top-8 animate-cloud-medium left-0 z-10" style={{ animationDelay: '-28s' }} breatheDelay={2} />
              <RealisticCloud size={140} variant="gray" className="absolute top-16 animate-cloud-fast left-0 z-10" style={{ animationDelay: '-18s' }} breatheDelay={4} />
           </div>
           {/* 雨滴动画 - 写实细长雨线 */}
           <div className="absolute inset-0 overflow-hidden opacity-70">
             {Array.from({ length: 55 }).map((_, i) => (
               <div 
                 key={i} 
                 className="absolute animate-rain"
                 style={{
                   left: `${Math.random() * 100}%`,
                   top: `-${Math.random() * 20 + 10}px`,
                   animationDelay: `${Math.random() * 2}s`,
                   animationDuration: `${Math.random() * 0.5 + 0.6}s`
                 }}
               >
                 <div 
                   className="bg-blue-200/50 rounded-full"
                   style={{
                     width: `${Math.random() * 0.5 + 0.5}px`,
                     height: `${Math.random() * 15 + 15}px`,
                   }}
                 />
               </div>
             ))}
           </div>
        </div>
      )}

      {/* 雪天 - 显示雪花图标 + 雪花飘落 */}
      {isSnow && (
        <div className={cn("absolute inset-0 pointer-events-none transition-opacity duration-1000", weatherOpacity)}>
           {/* 雪天云层 */}
           <div className="absolute inset-x-0 top-0 h-80">
              <RealisticCloud size={160} variant="white" className="absolute top-4 animate-cloud-slow left-0" style={{ animationDelay: '-14s' }} breatheDelay={0} />
              <RealisticCloud size={200} variant="white" className="absolute top-8 animate-cloud-medium left-0" style={{ animationDelay: '-30s' }} breatheDelay={2} />
              <RealisticCloud size={140} variant="white" className="absolute top-16 animate-cloud-fast left-0" style={{ animationDelay: '-8s' }} breatheDelay={4} />
           </div>
           {/* 雪花飘落 - 写实简洁圆点 */}
           <div className="absolute inset-0 overflow-hidden opacity-90">
             {Array.from({ length: 48 }).map((_, i) => {
               const size = Math.random() * 5 + 3;
               return (
                 <div 
                   key={i} 
                   className="absolute animate-snow"
                   style={{
                     left: `${Math.random() * 100}%`,
                     top: `-15px`,
                     animationDelay: `${Math.random() * 5}s`,
                     animationDuration: `${Math.random() * 3 + 3}s`
                   }}
                 >
                   <div 
                     className="bg-white rounded-full"
                     style={{
                       width: `${size}px`,
                       height: `${size}px`,
                       boxShadow: '0 0 3px 1px rgba(255, 255, 255, 0.4)',
                     }}
                   />
                 </div>
               );
             })}
           </div>
        </div>
      )}

      {/* 极轻压暗背景，仅在登录后保持文字清晰。数值过高会让半透明卡片（backdrop-blur）显得模糊 */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/[0.015] via-transparent to-black/[0.04]" />
    </div>
  );
};
