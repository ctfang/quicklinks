import { useEffect, useState } from 'react';
import type { CardLayout } from './navigationCard';

export interface NavigationAppearance {
  style: 'light' | 'midnight' | 'glass';
  background: typeof backgroundOptions[number][0];
  backgroundImage?: string;
  theme: 'aurora' | 'ocean' | 'sunset';
  cardMode: 'mixed' | 'uniform';
  layoutMode: CardLayout;
}

const defaults: NavigationAppearance = { style: 'light', background: 'gradient', theme: 'aurora', cardMode: 'mixed', layoutMode: 'mixed' };

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
      style: styleOptions.some(([style]) => style === saved.style) ? saved.style : defaults.style,
      background: backgroundOptions.some(([background]) => background === saved.background) ? saved.background : defaults.background,
      backgroundImage: safeBackgroundImage(saved.backgroundImage),
      theme: ['aurora', 'ocean', 'sunset'].includes(saved.theme) ? saved.theme : defaults.theme,
      cardMode: saved.cardMode === 'uniform' ? 'uniform' : 'mixed',
      layoutMode: ['configured', 'icons'].includes(saved.layoutMode) ? saved.layoutMode : 'mixed',
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
