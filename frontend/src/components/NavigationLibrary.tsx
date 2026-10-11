import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { NavGroup, NavLink, Project } from '../services/api';
import type { NavigationAppearance } from '../lib/navigationAppearance';
import { navigationCardSize } from '../lib/navigationCard';
import { buildSearchUrl } from '../lib/searchEngine';
import { useAppContext } from '../context/AppContext';
import { NavIcon } from './LinkGrid';
import { ClockWidget, WeatherWidget } from './Widgets';
import { WeatherLocationModal } from './WeatherLocationModal';

interface Section { id: string; title: string; project?: string; links: NavLink[] }

function sectionsFor(links: NavLink[], groups: NavGroup[], projects: Project[]): Section[] {
  const result: Section[] = [];
  const append = (items: NavLink[], categories: NavGroup[], project?: Project) => {
    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const group of [...categories].sort((a, b) => a.order - b.order)) {
      result.push({ id: group.id, title: group.name, project: project?.name, links: sorted.filter(link => link.groupId === group.id) });
    }
    const ungrouped = sorted.filter(link => !categories.some(group => group.id === link.groupId));
    if (ungrouped.length) result.push({ id: `ungrouped-${project?.id || 'general'}`, title: project ? '项目导航' : categories.length ? '未分组' : '常用网站', project: project?.name, links: ungrouped });
  };
  append(links.filter(link => !projects.some(project => project.id === link.projectId)), groups.filter(group => !group.projectId));
  for (const project of projects) append(links.filter(link => link.projectId === project.id), groups.filter(group => group.projectId === project.id), project);
  return result;
}

function SiteCard({ link, size }: { link: NavLink; size: string }) {
  let domain = link.url;
  try { domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch { /* 保留地址 */ }
  return <a className={`site-card size-${size}${link.bgColor ? ' has-custom-color' : ''}`} style={link.bgColor ? { background: link.bgColor } : undefined}
    href={link.url} target="_blank" rel="noopener noreferrer" title={`${link.title} · ${domain}`} aria-label={link.title}
    data-nav-title={link.title} data-nav-icon={link.icon} data-card-size={size}>
    <span className="site-icon"><NavIcon name={link.icon} url={link.url} label={link.title} pixelSize={size === 'medium' ? 40 : size === 'large' ? 34 : 26} strokeWidth={1.7} /></span>
    {size !== 'icon' && <span className="site-copy"><span className="site-name">{link.title}</span><span className="site-domain">{domain}</span></span>}
    {size !== 'icon' && <ArrowUpRight className="site-arrow" size={15} />}
  </a>;
}

export function NavigationLibrary({ links, groups, projects, appearance, loading, error }: {
  links: NavLink[]; groups: NavGroup[]; projects: Project[]; appearance: NavigationAppearance;
  loading: boolean; error: string;
}) {
  const { searchEngine, currentWeather, weatherLocation } = useAppContext();
  const [weatherLocationOpen, setWeatherLocationOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const sections = useMemo(() => sectionsFor(links, groups, projects), [links, groups, projects]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const editing = (event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]');
      if ((!editing && event.key === '/') || ((event.ctrlKey || event.metaKey) && event.key === 'k')) { event.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <div className="nav-library">
    <h1 className="sr-only">网站导航</h1>
    <WeatherLocationModal open={weatherLocationOpen} onClose={() => setWeatherLocationOpen(false)} />
    <div className="library-main">
      <div className="library-daily"><ClockWidget /><span className="daily-divider" aria-hidden="true" /><button type="button" className="daily-weather-button" aria-label={`天气：${currentWeather?.place || weatherLocation.city}，${currentWeather ? `${Math.round(currentWeather.temperature)}摄氏度，${currentWeather.weather1}。` : ''}修改天气城市`} title="修改天气城市" onClick={() => setWeatherLocationOpen(true)}><WeatherWidget weather={currentWeather} city={weatherLocation.city} /></button></div>
      <form className="library-search" onSubmit={event => { event.preventDefault(); if (query.trim()) window.location.href = buildSearchUrl(searchEngine, query.trim()); }} role="search">
        <Search size={19} /><input ref={input} aria-label="搜索网页" placeholder="搜索网页" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setQuery(''); input.current?.blur(); } }} />
        {query ? <button type="button" className="search-clear" aria-label="清空搜索" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={16} /></button> : <kbd>/</kbd>}
        <span className="search-separator" /><button className="search-web" type="submit" aria-label={`使用${searchEngine.name}搜索网页`}>{searchEngine.name}<ArrowUpRight size={14} /></button>
      </form>
      {error && <p className="library-error" role="alert">{error}</p>}
      {loading ? <div className="site-skeletons" role="status" aria-label="正在加载导航">{Array.from({ length: 8 }, (_, index) => <div key={index} />)}</div> : links.length === 0 ? <div className="library-empty"><Search size={28} /><h2>这里还没有导航</h2><p>可在管理工作台添加网站。</p></div> : sections.filter(section => section.links.length > 0).map(section => <section className="library-section" key={section.id} aria-label={section.title}>
        <div className="section-heading"><h2>{section.title}</h2>{section.project && <span className="section-project">{section.project}</span>}</div>
        <div className={`site-grid ${appearance.layoutMode === 'icons' ? 'icons-only' : ''} ${appearance.cardMode === 'uniform' ? 'uniform-cards' : ''}`}>{section.links.map((link, linkIndex) => <SiteCard key={link.id} link={link} size={navigationCardSize(link.displaySize, linkIndex, appearance.layoutMode)} />)}</div>
      </section>)}
    </div>
  </div>;
}
