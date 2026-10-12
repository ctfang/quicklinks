import { useEffect, useState } from 'react';
import type { CardLayout } from './navigationCard';

export interface NavigationAppearance {
  themePack?: 'custom' | 'yin-yang' | 'woodland' | 'rain' | 'day-ink' | 'winter' | 'desert';
  style: 'light' | 'midnight' | 'glass';
  background: typeof backgroundOptions[number][0];
  backgroundImage?: string;
  theme: 'aurora' | 'ocean' | 'sunset';
  cardMode: 'mixed' | 'uniform';
  layoutMode: CardLayout;
}

const defaults: NavigationAppearance = { themePack: 'yin-yang', style: 'light', background: 'gradient', theme: 'aurora', cardMode: 'mixed', layoutMode: 'configured' };

export const themePackPresets = {
  'yin-yang': { label: '双鱼太极', description: '深墨水韵 · 单元轮换', wallpaper: '/backgrounds/yin-yang-pond-v2.png', dark: true, accent: '#d4d9ac', bg: '#102622', surface: '#193831d9', card: '#1a3934c9', text: '#f1f0db', muted: '#c0cdbd', line: '#d4d9ac38', icon: '#e8ebd31a', radius: 24, shade: 'linear-gradient(#061b1724, #061b1775)' },
  woodland: { label: '草木深林', description: '苔木玻璃 · 草叶弧线', wallpaper: '/backgrounds/woodland-mist-v2.png', dark: true, accent: '#b3d398', bg: '#10251b', surface: '#1c3428e0', card: '#233b2bd4', text: '#eff5e3', muted: '#c1d0b7', line: '#b3d39835', icon: '#a6bc7326', radius: 16, shade: 'linear-gradient(#0b1e1524, #0b1e1575)' },
  rain: { label: '下雨', description: '雨滴玻璃 · 湖蓝微光', wallpaper: '/backgrounds/theme-rain-v1.png', dark: true, accent: '#a8dbdf', bg: '#132b35', surface: '#193e4dc7', card: '#1d4653c2', text: '#eef8f7', muted: '#c0d4d7', line: '#b0dde333', icon: '#a4d6db20', radius: 18, shade: 'linear-gradient(#102e3e35, #0b203a85)' },
  'day-ink': { label: '日间水墨', description: '米灰宣纸 · 淡墨六景', wallpaper: '/backgrounds/ink-card-landscape-v1.png', dark: false, accent: '#506a58', bg: '#deddd2', surface: '#e7e4d9e8', card: '#ebe7dae8', text: '#344039', muted: '#647064', line: '#7b8b7340', icon: '#d4dccc', radius: 18, shade: 'linear-gradient(#d9d8ce59, #d9d8ce88)' },
  winter: { label: '冬日毛绒', description: '绒毛包边 · 雾蓝暖灰', wallpaper: '/backgrounds/theme-winter-v1.png', dark: true, accent: '#9db0c6', bg: '#1c2532', surface: '#303b4bdc', card: '#354253e8', text: '#d3deeb', muted: '#a8b9cc', line: '#92a3b938', icon: '#435265', radius: 26, shade: 'linear-gradient(#152133a6, #101b2bbf)' },
  desert: { label: '沙漠炎日', description: '砂岩陶土 · 暮色铜棕', wallpaper: '/backgrounds/theme-desert-v1.png', dark: true, accent: '#c79265', bg: '#2c241f', surface: '#433127e8', card: '#4c392de8', text: '#e1c7a5', muted: '#baa389', line: '#b68a6338', icon: '#70553d', radius: 8, shade: 'linear-gradient(#30241b88, #251c16b8)' },
} as const;

export function getThemePack(id: NavigationAppearance['themePack']) {
  return id && id !== 'custom' ? themePackPresets[id] : undefined;
}

export const styleOptions = [['light', '浅雾'], ['midnight', '石墨'], ['glass', '琉璃']] as const;
export const backgroundOptions = [['gradient', '渐变'], ['plain', '纯色'], ['grid', '网格'], ['glow', '流光'], ['landscape', '山水'], ['taichi', '太极'], ['geometry', '几何'], ['dawn', '晨曦'], ['forest', '青林'], ['waves', '海浪'], ['dunes', '沙丘'], ['blossom', '樱霞'], ['stars', '星河'], ['paper', '纸纹'], ['contour', '等高线'], ['image', '图片']] as const;

export function safeBackgroundImage(url: string = '') {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

export function useNavigationAppearance(scope: string) {
  const key = `navihub_appearance_${scope}`;
  const [stored, setStored] = useState<{ key: string; value: NavigationAppearance } | null>(null);
  const [, refresh] = useState(0);
  useEffect(() => {
    const sync = (event: Event) => {
      setStored(event instanceof CustomEvent ? event.detail : null);
      refresh(version => version + 1);
    };
    window.addEventListener('navigation-appearance-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('navigation-appearance-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  let value = defaults;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved) value = {
      themePack: saved.themePack === 'autumn' ? 'day-ink' : (!saved.themePack || saved.themePack === 'custom') && ['yin-yang', 'woodland'].includes(saved.background) ? saved.background : saved.themePack === 'custom' || Object.hasOwn(themePackPresets, saved.themePack) ? saved.themePack : defaults.themePack,
      style: styleOptions.some(([style]) => style === saved.style) ? saved.style : defaults.style,
      background: backgroundOptions.some(([background]) => background === saved.background) ? saved.background : defaults.background,
      backgroundImage: safeBackgroundImage(saved.backgroundImage),
      theme: ['aurora', 'ocean', 'sunset'].includes(saved.theme) ? saved.theme : defaults.theme,
      cardMode: saved.cardMode === 'uniform' ? 'uniform' : 'mixed',
      layoutMode: ['mixed', 'configured', 'icons'].includes(saved.layoutMode) ? saved.layoutMode : defaults.layoutMode,
    };
  } catch { /* 使用默认外观 */ }
  if (stored?.key === key) value = stored.value;
  const save = (next: NavigationAppearance) => {
    setStored({ key, value: next });
    try {
      // 保留旧版配置数据，避免调整外观时覆盖历史悬浮导航配置。
      const previous = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...previous, ...next }));
      window.dispatchEvent(new CustomEvent('navigation-appearance-change', { detail: { key, value: next } }));
    } catch { /* 当前页面仍可使用 */ }
  };
  return [value, save] as const;
}
