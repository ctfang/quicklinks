import { useEffect, useRef, useState } from 'react';
import { getFloatingNavigation, saveFloatingNavigation } from '../services/api';

export interface FloatingLink {
  id: string;
  title: string;
  url: string;
  icon: string;
}
export interface FloatingNavigationConfig {
  leftEnabled: boolean;
  left: FloatingLink[];
}

export function defaultFloatingNavigation(): FloatingNavigationConfig {
  return {
    leftEnabled: true,
    left: [
      { id: 'chatgpt', title: 'ChatGPT', url: 'https://chatgpt.com/', icon: 'https://chatgpt.com/favicon.ico' },
      { id: 'claude', title: 'Claude', url: 'https://claude.ai/', icon: 'https://claude.ai/favicon.ico' },
      { id: 'gemini', title: 'Gemini', url: 'https://gemini.google.com/', icon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png' },
      { id: 'deepseek', title: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'https://chat.deepseek.com/favicon.ico' },
    ],
  };
}

export function normalizeFloatingUrl(value: string): string {
  const text = value.trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('请输入有效的 HTTP 或 HTTPS 网站地址');
  }
  return url.href;
}

export function parseFloatingNavigation(raw: string | null): FloatingNavigationConfig {
  const defaults = defaultFloatingNavigation();
  if (!raw) return defaults;
  try {
    const saved = JSON.parse(raw);
    const readLinks = () => {
      if (!Array.isArray(saved.left)) return defaults.left;
      const ids = new Set<string>();
      return saved.left.flatMap((item: unknown) => {
        if (!item || typeof item !== 'object') return [];
        const link = item as Partial<FloatingLink>;
        if (typeof link.id !== 'string' || !link.id || ids.has(link.id) || typeof link.title !== 'string' || !link.title.trim() || typeof link.url !== 'string') return [];
        try {
          const url = normalizeFloatingUrl(link.url);
          ids.add(link.id);
          return [{ id: link.id, title: link.title.trim(), url, icon: typeof link.icon === 'string' ? link.icon : 'Link' }];
        } catch { return []; }
      });
    };
    return { leftEnabled: saved.leftEnabled !== false, left: readLinks() };
  } catch { return defaults; }
}

export function useFloatingNavigation(userId: number | null) {
  const [stored, setStored] = useState<{ userId: number; value: FloatingNavigationConfig } | null>(null);
  const [status, setStatus] = useState<{ userId: number | null; error: string; ready: boolean; saving: boolean }>({ userId: null, error: '', ready: false, saving: false });
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const saving = useRef(false);
  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    setStatus({ userId, error: '', ready: false, saving: false });
    getFloatingNavigation(controller.signal).then(config => {
      if (controller.signal.aborted) return;
      setStored({ userId, value: parseFloatingNavigation(config ? JSON.stringify(config) : null) });
      setStatus({ userId, error: '', ready: true, saving: false });
    }).catch(err => {
      if (!controller.signal.aborted) setStatus({ userId, error: `读取左侧导航失败：${err.message}，请刷新重试。`, ready: false, saving: false });
    });
    return () => controller.abort();
  }, [userId]);
  const value = stored?.userId === userId ? stored.value : defaultFloatingNavigation();
  const ready = status.userId === userId && status.ready;
  const save = async (next: FloatingNavigationConfig) => {
    if (userId === null || !ready || saving.current) return false;
    saving.current = true;
    setStatus({ userId, error: '', ready: true, saving: true });
    try {
      const config = await saveFloatingNavigation(next);
      if (activeUser.current !== userId) return false;
      setStored({ userId, value: config });
      setStatus({ userId, error: '', ready: true, saving: false });
      return true;
    } catch (err) {
      if (activeUser.current === userId) setStatus({ userId, error: `保存左侧导航失败：${err instanceof Error ? err.message : '请重试'}`, ready: true, saving: false });
      return false;
    } finally { saving.current = false; }
  };
  return [value, save, status.userId === userId ? status.error : '', !ready || status.saving] as const;
}
