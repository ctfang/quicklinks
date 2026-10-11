import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, UserRound, Users, Search, CloudSun, ShieldCheck, RefreshCw, PanelsTopLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { NavigationContent } from '../components/NavigationContent';
import { AuthModal } from '../components/AuthModal';
import { Settings, SettingsTab } from './Settings';
import { Button, Skeleton } from 'antd';
import { FloatingNavigationSettings } from '../components/FloatingNavigationSettings';

const entries = [
  { id: 'navigation', label: '导航管理', icon: Link2, description: '维护链接、分组和项目。' },
  { id: 'floating', label: '悬浮导航', icon: PanelsTopLeft, description: '维护左侧快捷导航；右侧自动显示最近点击的导航。' },
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
    document.title = '设置 · Quicklinks';
    return () => { document.title = previous; };
  }, []);
  const { user, currentTeam, isLoading } = useAppContext();
  const [params, setParams] = useSearchParams();
  const [loginOpen, setLoginOpen] = useState(false);
  const tab = (entries.find(item => item.id === params.get('tab'))?.id || 'navigation') as SettingsTab | 'navigation' | 'floating';
  const active = entries.find(item => item.id === tab)!;
  return <div className="workspace-page settings-workspace">
    <div className="workspace-heading"><p>WORKSPACE</p><h1>设置</h1><span>打理您的空间，让常用内容触手可及。</span></div>
    <nav className="workspace-tabs" aria-label="设置菜单">{entries.map(entry => <button key={entry.id} aria-current={tab === entry.id ? 'page' : undefined} onClick={() => setParams({ tab: entry.id })}><entry.icon size={17} />{entry.label}</button>)}</nav>
    <div className="workspace-section-heading"><h2>{active.label}</h2><p>{active.description}</p></div>
    {isLoading ? <Skeleton active aria-label="正在加载设置" /> : !user ? <div className="workspace-empty"><ShieldCheck size={40} /><h2>登录您的空间</h2><p>登录后维护导航、团队和账号设置。</p><Button type="primary" onClick={() => setLoginOpen(true)}>登录账号</Button></div> : tab === 'navigation' ? <NavigationContent key={`${user.id}_${currentTeam?.id || 'personal'}`} management /> : tab === 'floating' ? <FloatingNavigationSettings key={`${user.id}_${currentTeam?.id || 'personal'}`} /> : <Settings key={`${tab}_${user.id}_${currentTeam?.id || 'personal'}`} section={tab} />}
    <AuthModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
  </div>;
}
