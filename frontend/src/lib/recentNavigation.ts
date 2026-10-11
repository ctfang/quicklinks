import { useEffect, useState } from 'react';
import { normalizeFloatingUrl, type FloatingLink } from './floatingNavigation';

export function updateRecentNavigation(current: FloatingLink[], link: FloatingLink): FloatingLink[] {
  const url = normalizeFloatingUrl(link.url);
  if (current[0]?.url === url && current[0].title === link.title && current[0].icon === link.icon) return current;
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

export const recentNavigationKey = 'navihub_recent_navigation';

export function readRecentNavigation(storage: Storage): FloatingLink[] {
  const saved = storage.getItem(recentNavigationKey);
  if (saved !== null) return parseRecentNavigation(saved);
  // 旧记录没有跨空间的点击时间，迁移时保留各列表内部顺序，合并并去重。
  const legacy: FloatingLink[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && /^navihub_recent_(guest|user_.+|team_.+)$/.test(key)) {
      legacy.push(...parseRecentNavigation(storage.getItem(key)));
    }
  }
  const links = parseRecentNavigation(JSON.stringify(legacy));
  try { storage.setItem(recentNavigationKey, JSON.stringify(links)); } catch { /* 无法写入时仍可读取旧记录 */ }
  return links;
}

export function useRecentNavigation() {
  const [links, setLinks] = useState<FloatingLink[]>(() => {
    try { return readRecentNavigation(localStorage); } catch { return []; }
  });
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === recentNavigationKey || event.key === null)) {
        setLinks(parseRecentNavigation(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const record = (link: FloatingLink) => {
    // 函数式更新保留连续点击，重复点击首项不触发列表重绘。
    setLinks(current => {
      let next: FloatingLink[];
      try { next = updateRecentNavigation(current, link); } catch { return current; }
      if (next === current) return current;
      try { localStorage.setItem(recentNavigationKey, JSON.stringify(next)); } catch { /* 无法写入时仍保留当前页面记录 */ }
      return next;
    });
  };
  return [links, record] as const;
}
