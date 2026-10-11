import { useState } from 'react';

export type FloatingSide = 'left' | 'right';
export interface FloatingLink {
  id: string;
  title: string;
  url: string;
  icon: string;
}
export interface FloatingNavigationConfig {
  leftEnabled: boolean;
  rightEnabled: boolean;
  left: FloatingLink[];
  right: FloatingLink[];
}

export function defaultFloatingNavigation(): FloatingNavigationConfig {
  return {
    leftEnabled: true,
    rightEnabled: true,
    left: [
      { id: 'chatgpt', title: 'ChatGPT', url: 'https://chatgpt.com/', icon: 'https://chatgpt.com/favicon.ico' },
      { id: 'claude', title: 'Claude', url: 'https://claude.ai/', icon: 'https://claude.ai/favicon.ico' },
      { id: 'gemini', title: 'Gemini', url: 'https://gemini.google.com/', icon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png' },
      { id: 'deepseek', title: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'https://chat.deepseek.com/favicon.ico' },
    ],
    right: [
      { id: 'github', title: 'GitHub', url: 'https://github.com/', icon: 'Github' },
      { id: 'mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org/', icon: 'BookOpen' },
      { id: 'stackoverflow', title: 'Stack Overflow', url: 'https://stackoverflow.com/', icon: 'MessageSquareCode' },
      { id: 'huggingface', title: 'Hugging Face', url: 'https://huggingface.co/', icon: 'Bot' },
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
    const readLinks = (side: FloatingSide) => {
      if (!Array.isArray(saved[side])) return defaults[side];
      const ids = new Set<string>();
      return saved[side].flatMap((item: unknown) => {
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
    return { leftEnabled: saved.leftEnabled !== false, rightEnabled: saved.rightEnabled !== false, left: readLinks('left'), right: readLinks('right') };
  } catch { return defaults; }
}

export function useFloatingNavigation(scope: string | null) {
  // 访客固定使用公共默认值，不能读到上一个登录账号的配置。
  const key = scope ? `navihub_floating_${scope}` : null;
  const [stored, setStored] = useState<{ key: string; value: FloatingNavigationConfig } | null>(null);
  const [error, setError] = useState('');
  let value = defaultFloatingNavigation();
  if (key) {
    try { value = parseFloatingNavigation(localStorage.getItem(key)); } catch { /* 当前浏览器禁止存储 */ }
    if (stored?.key === key) value = stored.value;
  }
  const save = (next: FloatingNavigationConfig) => {
    if (!key) return;
    setStored({ key, value: next });
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setError('');
    } catch { setError('浏览器无法保存设置，本次修改仅在当前页面生效。'); }
  };
  return [value, save, error] as const;
}
