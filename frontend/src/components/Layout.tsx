import React, { useState, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Settings as SettingsIcon, LogIn, LogOut, BookOpen, CloudRain, CloudSun, Cloud, Sun, CloudSnow, CloudLightning, Home, Github, Layers, UserRound, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { AuthModal } from './AuthModal';

import { WeatherBackground } from './WeatherBackground';
import { WeatherLocationModal } from './WeatherLocationModal';
import { WeatherInfo } from '../services/api';

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
  const { user, logoutUser, currentTeam, teams, setCurrentTeam, currentWeather, weatherLocation } =
    useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showWeatherLocationModal, setShowWeatherLocationModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTeamDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 使用全局共享的天气数据
  const weatherWidget: WeatherInfo | null = currentWeather;

  return (
    <div className={cn('navigation-shell min-h-screen w-full text-white font-sans flex flex-col relative overflow-hidden bg-slate-900', location.pathname === '/' && 'homepage-shell')}>
      <WeatherLocationModal open={showWeatherLocationModal} onClose={() => setShowWeatherLocationModal(false)} />
      <WeatherBackground />
      
      <header className="navigation-header z-50">
        <div className="navigation-header-start">
          <Link to="/" className="navigation-brand" aria-label="Quicklinks 首页" title="Quicklinks 首页"><Layers size={19} /></Link>
          {user && (
            <div className="navigation-space-switch relative z-[60] flex items-center">
              <button 
                onClick={() => {
                  setCurrentTeam(null);
                  navigate('/');
                }}
                aria-pressed={currentTeam === null}
                aria-label="个人空间"
                title="个人空间"
              >
                <UserRound size={18} />
              </button>
              
              {teams.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                    aria-expanded={showTeamDropdown}
                    aria-pressed={currentTeam !== null}
                    aria-label={currentTeam ? `团队空间：${currentTeam.name}` : '团队空间'}
                    title={currentTeam ? `团队空间：${currentTeam.name}` : '团队空间'}
                  >
                    <Users size={18} />
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

        <div className="navigation-header-end">
          {/* Weather Widget - now powered by backend service with caching */}
          <button
            type="button"
            onClick={() => setShowWeatherLocationModal(true)}
            className="navigation-weather flex items-center gap-2 transition-colors cursor-pointer border-0 bg-transparent"
            aria-label="修改天气城市"
            title={`${weatherWidget ? `${Math.round(weatherWidget.temperature)}°C ${weatherWidget.place}` : weatherLocation.city} · 修改天气城市`}
          >
            <WeatherIcon weather={weatherWidget?.weather1 || '晴'} />
          </button>

          <nav aria-label="主导航" className="flex items-center">
            {[{ to: '/', label: '导航', icon: Home }, { to: '/wiki', label: '知识库', icon: BookOpen }, { to: '/manage', label: '管理', icon: SettingsIcon }].map(item => (
              <Link key={item.to} to={item.to} aria-label={item.label} title={item.label} aria-current={(item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)) ? 'page' : undefined} className="flex items-center transition-colors">
                <item.icon size={18} />
              </Link>
            ))}
          </nav>
          {user ? (
            <>
              <div className="relative group">
                <button aria-label="账号菜单" title="账号菜单" className="navigation-avatar rounded-full overflow-hidden border border-white/20 transition-colors">
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover bg-white" />
                </button>
                <div className="absolute right-0 top-full pt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all transform origin-top-right z-50">
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
              aria-label="登录"
              title="登录"
              className="navigation-login flex items-center gap-1.5 font-medium transition-colors"
            >
              <LogIn size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        <Outlet />
      </main>

      {/* Footer: ICP filing (homepage) + GitHub */}
      <footer className="absolute bottom-0 w-full p-6 flex justify-between items-end z-10 text-xs font-medium text-white/70 drop-shadow-md pointer-events-none">
        {location.pathname === '/' && (
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto hover:text-white transition-colors"
          >
            粤ICP备2025373248号-1
          </a>
        )}
        <a
          href="https://github.com/ctfang/quicklinks"
          aria-label="项目源码 GitHub"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 hover:text-white transition-all',
            location.pathname !== '/' && 'ml-auto'
          )}
        >
          <Github size={16} />
          <span>GitHub</span>
        </a>
      </footer>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

    </div>
  );
};
