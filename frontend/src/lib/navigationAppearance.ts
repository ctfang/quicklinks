import { useState } from 'react';
import type { CardLayout } from './navigationCard';

export interface NavigationAppearance {
  style: 'light' | 'midnight' | 'glass';
  background: 'gradient' | 'plain' | 'grid' | 'glow';
  theme: 'aurora' | 'ocean' | 'sunset';
  cardMode: 'mixed' | 'uniform';
  layoutMode: CardLayout;
}

const defaults: NavigationAppearance = { style: 'light', background: 'gradient', theme: 'aurora', cardMode: 'mixed', layoutMode: 'mixed' };

export const styleOptions = [['light', '浅雾'], ['midnight', '石墨'], ['glass', '琉璃']] as const;
export const backgroundOptions = [['gradient', '渐变'], ['plain', '纯色'], ['grid', '网格'], ['glow', '流光']] as const;

export function useNavigationAppearance(scope: string) {
  const key = `navihub_appearance_${scope}`;
  const [stored, setStored] = useState<{ key: string; value: NavigationAppearance } | null>(null);
  let value = defaults;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved) value = {
      style: styleOptions.some(([style]) => style === saved.style) ? saved.style : defaults.style,
      background: backgroundOptions.some(([background]) => background === saved.background) ? saved.background : defaults.background,
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
    } catch { /* 当前页面仍可使用 */ }
  };
  return [value, save] as const;
}
