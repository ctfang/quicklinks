import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Link2, UserRound, Users, Search, CloudSun, ShieldCheck, RefreshCw, PanelsTopLeft, ArrowUpRight, BookOpen, LogOut, LogIn, ChevronRight, Menu } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { NavigationContent } from '../components/NavigationContent';
import { AuthModal } from '../components/AuthModal';
import { Settings, SettingsTab } from './Settings';
import { Avatar, Button, ConfigProvider, Menu as AntMenu, Select, Skeleton } from 'antd';
import { FloatingNavigationSettings } from '../components/FloatingNavigationSettings';

const entries = [
  { id: 'navigation', label: '导航管理', icon: Link2, description: '维护链接、分组和项目，配置导航外观。' },
  { id: 'floating', label: '悬浮导航', icon: PanelsTopLeft, description: '维护左侧快捷导航，设置右侧最近点击导航的显示。' },
  { id: 'profile', label: '个人资料', icon: UserRound, description: '查看您的账号资料和身份信息。' },
  { id: 'teams', label: '团队管理', icon: Users, description: '管理团队、成员及协作空间。' },
  { id: 'search', label: '搜索引擎', icon: Search, description: '选择导航页使用的默认搜索引擎。' },
  { id: 'weather', label: '天气城市', icon: CloudSun, description: '设置天气服务使用的省份与城市。' },
  { id: 'widgets', label: '小组件', icon: PanelsTopLeft, description: '配置个人空间的小组件。' },
  { id: 'security', label: '账号安全', icon: ShieldCheck, description: '维护账号密码与安全设置。' },
  { id: 'sync', label: '数据同步', icon: RefreshCw, description: '刷新本地缓存，获取最新导航数据。' },
] as const;

export function Management() {
  useEffect(() => {
    const previous = document.title;
    document.title = '管理工作台 · Quicklinks';
    return () => { document.title = previous; };
  }, []);
  const { user, currentTeam, teams, setCurrentTeam, isLoading, logoutUser } = useAppContext();
  const [tab, setTab] = useState<SettingsTab | 'navigation' | 'floating'>('navigation');
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = entries.find(item => item.id === tab)!;
  return <div className="enterprise-workbench">
    <aside className={`workbench-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <Link to="/manage" className="workbench-brand"><span><LayoutDashboard size={22} /></span><div>Quicklinks<small>企业工作台</small></div></Link>
      <nav aria-label="工作台菜单"><ConfigProvider theme={{ components: { Menu: { darkItemBg: '#111c30', darkSubMenuItemBg: '#111c30', darkItemSelectedBg: '#2563eb' } } }}>
        <AntMenu theme="dark" mode="inline" selectedKeys={[tab]} onClick={({ key }) => { setTab(key as typeof tab); setMenuOpen(false); }} items={[
          { type: 'group', label: '内容管理', children: entries.slice(0, 4).map(entry => ({ key: entry.id, label: entry.label, icon: <entry.icon size={18} /> })) },
          { type: 'group', label: '偏好与安全', children: entries.slice(4).map(entry => ({ key: entry.id, label: entry.label, icon: <entry.icon size={18} /> })) },
        ]} />
      </ConfigProvider></nav>
      <div className="sidebar-bottom"><Link to="/"><ArrowUpRight size={17} />访问导航</Link><Link to="/wiki"><BookOpen size={17} />打开知识库</Link><p>QUICKLINKS WORKSPACE</p></div>
    </aside>
    <div className="workbench-main">
      <header className="workbench-topbar"><div className="flex items-center gap-3"><Button type="text" className="md:hidden" aria-label="展开工作台菜单" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} icon={<Menu size={21} />} /><span>工作台</span><ChevronRight size={14} /><strong>{active.label}</strong></div><div className="flex items-center gap-4">{user ? <><Avatar src={user.avatar} alt={user.name} /><span className="text-sm">{user.name}</span><Button type="text" aria-label="退出登录" onClick={logoutUser} icon={<LogOut size={17} />} /></> : <Button type="primary" onClick={() => setLoginOpen(true)} icon={<LogIn size={17} />}>登录账号</Button>}</div></header>
      <main className="workbench-body">
        <div className="workbench-heading"><div><p>WORKSPACE / {tab === 'navigation' ? 'NAVIGATION' : 'SETTINGS'}</p><h1>{active.label}</h1><span>{active.description}</span></div>{user && <div className="workspace-switcher"><span>当前空间</span><Select aria-label="选择管理空间" className="min-w-48" value={currentTeam?.id || ''} onChange={id => setCurrentTeam(teams.find(team => team.id === id) || null)} options={[{ value: '', label: '个人空间' }, ...teams.map(team => ({ value: team.id, label: team.name }))]} /></div>}</div>
        {isLoading ? <Skeleton active aria-label="正在加载工作台" /> : !user ? <div className="workbench-empty"><ShieldCheck size={40} /><h2>登录您的工作台</h2><p>登录后统一维护导航、团队和账号设置。</p><Button type="primary" onClick={() => setLoginOpen(true)}>登录账号</Button></div> : tab === 'navigation' ? <NavigationContent key={`${user.id}_${currentTeam?.id || 'personal'}`} management /> : tab === 'floating' ? <FloatingNavigationSettings key={`${user.id}_${currentTeam?.id || 'personal'}`} /> : <Settings key={tab} section={tab} />}
      </main>
      <footer className="workbench-footer">Quicklinks 管理工作台<span>个人与团队协作空间</span></footer>
    </div>
    <AuthModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
  </div>;
}
