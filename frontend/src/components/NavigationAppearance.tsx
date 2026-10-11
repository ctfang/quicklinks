import { Button, Popover } from 'antd';
import { Palette } from 'lucide-react';
import { NavigationAppearance as Appearance, styleOptions, backgroundOptions } from '../lib/navigationAppearance';
import { FloatingNavigationConfig, type FloatingLink } from '../lib/floatingNavigation';
import { NavIcon } from './LinkGrid';

export function FloatingNavigation({ value, recent }: { value: FloatingNavigationConfig; recent: FloatingLink[] }) {
  return <>{(['left', 'right'] as const).map(side => {
    const links = side === 'left' ? value.left : recent;
    return value[`${side}Enabled`] && links.length > 0 && (
    <nav key={side} aria-label={side === 'left' ? '左侧快捷导航' : '最近点击导航'} className={`floating-navigation floating-${side}`}>
      {links.map(link => (
        <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" title={link.title} aria-label={link.title} data-nav-title={link.title} data-nav-icon={link.icon} className="floating-link">
          <NavIcon name={link.icon} url={link.url} label={link.title} pixelSize={28} strokeWidth={1.7} />
          <span className="floating-label">{link.title}</span>
        </a>
      ))}
    </nav>
  ); })}</>;
}

function AppearanceControls({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  return <div className="appearance-controls space-y-4">
    <div><p className="text-sm font-medium mb-2">风格</p><div className="appearance-style-options">{styleOptions.map(([style, label]) => <button className={`appearance-style-option preview-${style}`} key={style} aria-pressed={value.style === style} onClick={() => onChange({ ...value, style })}><span className="style-preview"><i /><i /><i /></span><span>{label}</span></button>)}</div></div>
    <div><p className="text-sm font-medium mb-2">背景</p><div className="appearance-background-options">{backgroundOptions.map(([background, label]) => <button key={background} aria-pressed={value.background === background} onClick={() => onChange({ ...value, background })}><span className={`background-preview preview-${background}`} /><span>{label}</span></button>)}</div></div>
    <div><p className="text-sm font-medium mb-2">强调色</p><div className="appearance-colors">{([['aurora', '经典蓝'], ['ocean', '青绿'], ['sunset', '陶土']] as const).map(([theme, label]) => <button key={theme} className={`color-${theme}`} aria-label={label} aria-pressed={value.theme === theme} title={label} onClick={() => onChange({ ...value, theme })} />)}</div></div>
    <div><p className="text-sm font-medium mb-2">布局</p><div className="flex flex-wrap gap-2">{([['mixed', '大小错落'], ['icons', '仅图标'], ['configured', '按链接设置']] as const).map(([layoutMode, label]) => <Button size="small" key={layoutMode} aria-pressed={value.layoutMode === layoutMode} type={value.layoutMode === layoutMode ? 'primary' : 'default'} onClick={() => onChange({ ...value, layoutMode })}>{label}</Button>)}</div></div>
  </div>;
}

export function NavigationAppearanceQuickSwitch({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  return <Popover trigger="click" placement="topRight" title="快速切换外观" content={<AppearanceControls value={value} onChange={onChange} />}><Button className="appearance-quick-switch" size="small" icon={<Palette size={15} />}>外观</Button></Popover>;
}

export function NavigationAppearanceSettings({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  return <section className="appearance-settings rounded-xl border border-slate-200 bg-white p-6 space-y-6">
    <div><h2 className="text-xl font-semibold">导航外观</h2><p className="text-sm text-slate-500 mt-2">设置自动保存到当前浏览器，按个人 / 团队空间独立保存。首页可快速切换；左侧导航单独管理，右侧显示最近点击的 8 个网站。</p></div>
    <AppearanceControls value={value} onChange={onChange} />
    <div className="flex items-center gap-3 flex-wrap"><span className="text-sm font-medium">默认卡片风格</span>{([['mixed', '重点卡片强调'], ['uniform', '统一简约风格']] as const).map(([mode, label]) => <Button type={value.cardMode === mode ? 'primary' : 'default'} key={mode} aria-pressed={value.cardMode === mode} onClick={() => onChange({ ...value, cardMode: mode })} >{label}</Button>)}</div>
    <p className="text-sm text-slate-500">大小错落自动组合尺寸，保留链接设置的图标尺寸；仅图标隐藏所有卡片文字；按链接设置使用每条导航保存的尺寸。</p>
  </section>;
}
