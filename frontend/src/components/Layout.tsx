import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Settings as SettingsIcon, LogIn, LogOut, BookOpen, CloudRain, CloudSun, Cloud, Sun, CloudSnow, CloudLightning, Github, Layers, UserRound, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { AuthModal } from './AuthModal';
import { Dropdown } from 'antd';
import { safeBackgroundImage, useNavigationAppearance } from '../lib/navigationAppearance';
import type { CSSProperties } from 'react';


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
  const scope = currentTeam ? `team_${currentTeam.id}` : user ? `user_${user.id}` : 'guest';
  const [appearance] = useNavigationAppearance(scope);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showWeatherLocationModal, setShowWeatherLocationModal] = useState(false);
  const selectSpace = (id: string) => {
    if (!user) { setShowAuthModal(true); return; }
    if (id === '__teams') { navigate('/manage?tab=teams'); return; }
    setCurrentTeam(teams.find(team => team.id === id) || null);
    if (location.pathname.startsWith('/wiki/')) navigate(id ? `/wiki/${id}` : '/wiki');
  };
  // 使用全局共享的天气数据
  const weatherWidget: WeatherInfo | null = currentWeather;

  return (
    <div className={`navigation-shell homepage-shell theme-${appearance.theme} style-${appearance.style} background-${appearance.background} min-h-screen w-full font-sans flex flex-col relative`} style={{ '--navigation-image': safeBackgroundImage(appearance.backgroundImage) ? `url(${JSON.stringify(safeBackgroundImage(appearance.backgroundImage))})` : undefined } as CSSProperties}>
      <WeatherLocationModal open={showWeatherLocationModal} onClose={() => setShowWeatherLocationModal(false)} />


      <header className="navigation-header z-50">
        <div className="navigation-header-start">
          <Link to="/" className="navigation-brand" aria-label="Quicklinks 首页" title="Quicklinks 首页"><Layers size={19} /></Link>
          <div className="navigation-space-switch flex items-center" role="group" aria-label="切换空间">
            <button type="button" aria-label="个人空间" title="个人空间" aria-pressed={!currentTeam} onClick={() => selectSpace('')}><UserRound size={18} /></button>
            <Dropdown trigger={['click']} placement="bottomLeft" menu={{
              selectable: true,
              selectedKeys: currentTeam ? [currentTeam.id] : ['__personal'],
              items: [
                { key: '__personal', label: '个人空间', icon: <UserRound size={15} /> },
                ...teams.map(team => ({ key: team.id, label: team.name, icon: <Users size={15} /> })),
                ...(teams.length ? [{ type: 'divider' as const }] : []),
                { key: '__teams', label: '创建或加入团队', icon: <Users size={15} /> },
              ],
              onClick: ({ key }) => selectSpace(key === '__personal' ? '' : key),
            }}>
              <button type="button" className={currentTeam ? 'navigation-team-switch' : undefined} aria-label={currentTeam ? `团队空间：${currentTeam.name}，点击切换空间` : '团队空间'} title={currentTeam ? `团队空间：${currentTeam.name} · 点击切换空间` : '团队空间'} aria-pressed={Boolean(currentTeam)}>
                <Users size={18} />
                {currentTeam && <span className="navigation-team-name">{currentTeam.name}</span>}
              </button>
            </Dropdown>
          </div>
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
            {[{ to: '/wiki', label: '知识库', icon: BookOpen }, { to: '/manage', label: '设置', icon: SettingsIcon }].map(item => (
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
      {!location.pathname.startsWith('/wiki/') && <footer className="absolute bottom-0 w-full p-6 flex justify-between items-end z-10 text-xs font-medium text-white/70 drop-shadow-md pointer-events-none">
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
      </footer>}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

    </div>
  );
};
