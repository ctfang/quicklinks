import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Settings as SettingsIcon, LogIn, LogOut, BookOpen, CloudRain, CloudSun, Cloud, Sun, CloudSnow, CloudLightning, ChevronDown, Home, Github } from 'lucide-react';
import { cn } from '../lib/utils';
import { AuthModal } from './AuthModal';
import { Settings } from '../pages/Settings';
import { WeatherBackground } from './WeatherBackground';
import { getWeather, WeatherInfo } from '../services/api';

// 根据天气类型返回对应的图标组件
const WeatherIcon = ({ weather }: { weather: string }) => {
  const w = weather || '晴';
  if (w.includes('雨')) return <CloudRain size={18} />;
  if (w.includes('雪')) return <CloudSnow size={18} />;
  if (w.includes('雷')) return <CloudLightning size={18} />;
  if (w.includes('阴')) return <Cloud size={18} />;
  if (w.includes('云') || w.includes('多云')) return <CloudSun size={18} />;
  return <Sun size={18} />;
};

export const Layout = () => {
  const { user, logoutUser, currentTeam, teams, setCurrentTeam, setIsSettingsOpen } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [weatherWidget, setWeatherWidget] = useState<WeatherInfo | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTeamDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 获取天气用于头部小部件（后端已缓存）
  useEffect(() => {
    const fetchWidgetWeather = async () => {
      try {
        const data = await getWeather();
        setWeatherWidget(data);
      } catch (err) {
        console.error('Failed to fetch widget weather', err);
        setWeatherWidget({ weather1: '晴', temperature: 22, place: '深圳' });
      }
    };
    fetchWidgetWeather();
  }, []);

  return (
    <div className="min-h-screen w-full text-white font-sans flex flex-col relative overflow-hidden bg-slate-900">
      <WeatherBackground />
      
      <header className="relative w-full h-20 flex items-center justify-between px-6 lg:px-12 z-50 pt-4">
        <div className="flex items-center gap-6">
          {user && (
            <div className="relative z-[60] flex items-center gap-2 bg-black/20 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-lg">
              <button 
                onClick={() => {
                  setCurrentTeam(null);
                  navigate('/');
                }}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all duration-300", 
                  currentTeam === null ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                个人空间
              </button>
              
              {teams.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                    className={cn(
                      "px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2", 
                      currentTeam !== null ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {currentTeam ? currentTeam.name : '团队空间'}
                    <ChevronDown size={14} className={cn("transition-transform duration-300", showTeamDropdown ? "rotate-180" : "")} />
                  </button>
                  
                  {showTeamDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        我加入的团队
                      </div>
                      {teams.map(t => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setCurrentTeam(t);
                            setShowTeamDropdown(false);
                            navigate('/');
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2",
                            currentTeam?.id === t.id ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          <div className={cn("w-1.5 h-1.5 rounded-full", currentTeam?.id === t.id ? "bg-blue-600" : "bg-transparent")} />
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Weather Widget - now powered by backend service with caching */}
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium drop-shadow-md mr-4 hover:bg-white/10 px-3 py-2 rounded-full transition-colors cursor-pointer">
            <WeatherIcon weather={weatherWidget?.weather1 || '晴'} />
            <span>
              {weatherWidget
                ? `${Math.round(weatherWidget.temperature)}°C ${weatherWidget.place}`
                : '22°C 深圳'}
            </span>
          </div>

          {user ? (
            <>
              {currentTeam && (
                <Link 
                  to={`/wiki/${currentTeam.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors bg-black/20 hover:bg-black/40 backdrop-blur-md border border-white/10 shadow-sm"
                >
                  <BookOpen size={18} />
                  <span className="hidden sm:inline">团队 Wiki</span>
                </Link>
              )}
              {location.pathname !== '/' ? (
                <Link 
                  to="/"
                  className="p-2.5 rounded-full transition-colors bg-black/20 hover:bg-black/40 backdrop-blur-md border border-white/10 shadow-sm"
                  title="返回首页"
                >
                  <Home size={20} />
                </Link>
              ) : (
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 rounded-full transition-colors bg-black/20 hover:bg-black/40 backdrop-blur-md border border-white/10 shadow-sm"
                  title="设置"
                >
                  <SettingsIcon size={20} />
                </button>
              )}
              <div className="relative group">
                <button className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50 shadow-sm hover:border-white transition-colors">
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover bg-white" />
                </button>
                <div className="absolute right-0 top-full pt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
                  <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden text-slate-900">
                    <div className="p-4 border-b border-slate-100">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button 
                        onClick={logoutUser}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <LogOut size={16} />
                        退出登录
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm"
            >
              <LogIn size={16} />
              登录
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        <Outlet />
      </main>

      {/* Footer with GitHub repo link */}
      <footer className="absolute bottom-0 w-full p-6 flex justify-end items-end z-10 text-xs font-medium text-white/70 drop-shadow-md pointer-events-none">
        <a
          href="https://github.com/ctfang/quicklinks"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 hover:text-white transition-all"
        >
          <Github size={16} />
          <span>GitHub</span>
        </a>
      </footer>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <Settings />
    </div>
  );
};
