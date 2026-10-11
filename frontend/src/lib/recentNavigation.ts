import { useState } from 'react';
import { normalizeFloatingUrl, type FloatingLink } from './floatingNavigation';

export function updateRecentNavigation(current: FloatingLink[], link: FloatingLink): FloatingLink[] {
  const url = normalizeFloatingUrl(link.url);
  return [{ ...link, id: url, url }, ...current.filter(item => item.url !== url)].slice(0, 8);
}

export function parseRecentNavigation(raw: string | null): FloatingLink[] {
  try {
    const saved: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(saved)) return [];
    const result: FloatingLink[] = [];
    for (const item of saved) {
      if (!item || typeof item.title !== 'string' || !item.title.trim() || typeof item.url !== 'string') continue;
      try {
        const url = normalizeFloatingUrl(item.url);
        if (!result.some(link => link.url === url)) result.push({ id: url, title: item.title, url, icon: typeof item.icon === 'string' ? item.icon : 'Link' });
      } catch { /* 忽略无效记录 */ }
      if (result.length === 8) break;
    }
    return result;
  } catch { return []; }
}

export function useRecentNavigation(scope: string) {
  const key = `navihub_recent_${scope}`;
  const [stored, setStored] = useState<{ key: string; links: FloatingLink[] } | null>(null);
  const read = () => {
    try { return parseRecentNavigation(localStorage.getItem(key)); } catch { return []; }
  };
  const links = stored?.key === key ? stored.links : read();
  const record = (link: FloatingLink) => {
    let next: FloatingLink[];
    try { next = updateRecentNavigation(links, link); } catch { return; }
    setStored({ key, links: next });
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* 无法写入时仍保留当前页面记录 */ }
  };
  return [links, record] as const;
}
