import { memo } from 'react';
import { Button, Input, Popover } from 'antd';
import { Palette } from 'lucide-react';
import { NavigationAppearance as Appearance, styleOptions, backgroundOptions, themePackPresets } from '../lib/navigationAppearance';
import { FloatingNavigationConfig, type FloatingLink } from '../lib/floatingNavigation';
import { NavIcon } from './LinkGrid';

export const FloatingNavigation = memo(function FloatingNavigation({ value, recent }: { value: FloatingNavigationConfig; recent: FloatingLink[] }) {
  return <>{(['left', 'right'] as const).map(side => {
    const links = side === 'left' ? value.left : recent;
    return (side === 'right' || value.leftEnabled) && links.length > 0 && (
    <nav key={side} aria-label={side === 'left' ? '左侧快捷导航' : '最近点击导航'} className={`floating-navigation floating-${side}`}>
      {links.map(link => (
        <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" title={link.title} aria-label={link.title} data-nav-title={link.title} data-nav-icon={link.icon} className="floating-link">
          <NavIcon name={link.icon} url={link.url} label={link.title} pixelSize={28} strokeWidth={1.7} />
          <span className="floating-label">{link.title}</span>
        </a>
      ))}
    </nav>
  ); })}</>;
});

function AppearanceControls({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  return <div className="appearance-controls space-y-4">
    <div><p className="text-sm font-medium mb-2">主题套装</p><div className="theme-pack-options">{Object.entries(themePackPresets).map(([id, pack]) => <button key={id} type="button" className={`theme-pack-option theme-preview-${id}`} aria-pressed={value.themePack === id} onClick={() => onChange({ ...value, themePack: id as Appearance['themePack'] })}>
      <span className="theme-pack-miniature" style={{ backgroundImage: `url('${pack.wallpaper}')`, '--preview-surface': pack.surface, '--preview-radius': `${pack.radius / 2}px` } as React.CSSProperties}><i className="theme-mini-search" /><span className="theme-mini-cards"><i /><i /><i /></span></span>
      <strong>{pack.label}</strong><small>{pack.description}</small>
    </button>)}</div><Button size="small" className="mt-3" aria-pressed={!value.themePack || value.themePack === 'custom'} onClick={() => onChange({ ...value, themePack: 'custom' })}>自由搭配</Button></div>
    {value.themePack && value.themePack !== 'custom' ? <p className="text-xs text-slate-500">套装统一设计背景、搜索栏、卡片和按钮；选择“自由搭配”恢复原有外观。</p> : <>
    <div><p className="text-sm font-medium mb-2">风格</p><div className="appearance-style-options">{styleOptions.map(([style, label]) => <button className={`appearance-style-option preview-${style}`} key={style} aria-pressed={value.style === style} onClick={() => onChange({ ...value, style })}><span className="style-preview"><i /><i /><i /></span><span>{label}</span></button>)}</div></div>
    <div><p className="text-sm font-medium mb-2">背景</p><div className="appearance-background-options">{backgroundOptions.map(([background, label]) => <button key={background} aria-pressed={value.background === background} onClick={() => onChange({ ...value, background })}><span className={`background-preview preview-${background}`} /><span>{label}</span></button>)}</div></div>
    {value.background === 'image' && <div><label htmlFor="background-image-url" className="text-sm block mb-2">图片地址</label><Input id="background-image-url" type="url" placeholder="https://example.com/background.jpg" value={value.backgroundImage || ''} onChange={event => onChange({ ...value, backgroundImage: event.target.value })} /><p className="text-xs text-slate-500 mt-2">支持 HTTP / HTTPS 图片链接，留空时显示默认山水背景。</p></div>}
    <div><p className="text-sm font-medium mb-2">强调色</p><div className="appearance-colors">{([['aurora', '经典蓝'], ['ocean', '青绿'], ['sunset', '陶土']] as const).map(([theme, label]) => <button key={theme} className={`color-${theme}`} aria-label={label} aria-pressed={value.theme === theme} title={label} onClick={() => onChange({ ...value, theme })} />)}</div></div>
    </>}
    <div><p className="text-sm font-medium mb-2">布局</p><div className="flex flex-wrap gap-2">{([['mixed', '大小错落'], ['icons', '仅图标'], ['configured', '按链接设置']] as const).map(([layoutMode, label]) => <Button size="small" key={layoutMode} aria-pressed={value.layoutMode === layoutMode} type={value.layoutMode === layoutMode ? 'primary' : 'default'} onClick={() => onChange({ ...value, layoutMode })}>{label}</Button>)}</div></div>
  </div>;
}

export function NavigationAppearanceQuickSwitch({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  return <Popover trigger="click" placement="topRight" title="快速切换外观" content={<div className="appearance-quick-controls"><AppearanceControls value={value} onChange={onChange} /></div>}><Button className="appearance-quick-switch" size="small" icon={<Palette size={15} />}>外观</Button></Popover>;
}

export function NavigationAppearanceSettings({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  return <section className="appearance-settings rounded-xl border border-slate-200 bg-white p-6 space-y-6">
    <div><h2 className="text-xl font-semibold">导航外观</h2><p className="text-sm text-slate-500 mt-2">外观设置自动保存到当前浏览器，按个人 / 团队空间独立保存。首页可快速切换；左侧导航单独管理，右侧显示当前浏览器最近点击的 8 个网站，所有账号和团队共用。</p></div>
    <AppearanceControls value={value} onChange={onChange} />
    <div className="flex items-center gap-3 flex-wrap"><span className="text-sm font-medium">默认卡片风格</span>{([['mixed', '重点卡片强调'], ['uniform', '统一简约风格']] as const).map(([mode, label]) => <Button type={value.cardMode === mode ? 'primary' : 'default'} key={mode} aria-pressed={value.cardMode === mode} onClick={() => onChange({ ...value, cardMode: mode })} >{label}</Button>)}</div>
    <p className="text-sm text-slate-500">大小错落自动组合尺寸，保留链接设置的图标尺寸；仅图标隐藏所有卡片文字；按链接设置使用每条导航保存的尺寸。</p>
  </section>;
}
