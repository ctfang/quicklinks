// 搜索引擎配置
export interface SearchEngine {
  id: string;
  name: string;
  icon: string;
  searchUrl: string;
}

// 支持的搜索引擎列表
export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'baidu',
    name: '百度',
    icon: 'https://www.baidu.com/favicon.ico',
    searchUrl: 'https://www.baidu.com/s?wd={query}',
  },
  {
    id: 'google',
    name: '谷歌',
    icon: 'https://www.google.com/favicon.ico',
    searchUrl: 'https://www.google.com/search?q={query}',
  },
  {
    id: 'bing',
    name: '必应',
    icon: 'https://www.bing.com/favicon.ico',
    searchUrl: 'https://www.bing.com/search?q={query}',
  },
];

// 默认搜索引擎
export const DEFAULT_SEARCH_ENGINE = SEARCH_ENGINES[0]; // 百度

// localStorage 键名
const STORAGE_KEY = 'navihub_search_engine';

// 从 localStorage 读取搜索引擎设置
export function readSearchEngineFromStorage(): SearchEngine {
  if (typeof window === 'undefined') {
    return DEFAULT_SEARCH_ENGINE;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 验证保存的搜索引擎是否有效
      const validEngine = SEARCH_ENGINES.find(e => e.id === parsed.id);
      if (validEngine) {
        return validEngine;
      }
    }
  } catch {
    // 解析失败，使用默认值
  }
  return DEFAULT_SEARCH_ENGINE;
}

// 保存搜索引擎设置到 localStorage
export function writeSearchEngineToStorage(engine: SearchEngine): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(engine));
  } catch {
    // 忽略 localStorage 写入错误
  }
}

// 根据 ID 获取搜索引擎
export function getSearchEngineById(id: string): SearchEngine {
  return SEARCH_ENGINES.find(e => e.id === id) || DEFAULT_SEARCH_ENGINE;
}

// 构建搜索 URL
export function buildSearchUrl(engine: SearchEngine, query: string): string {
  return engine.searchUrl.replace('{query}', encodeURIComponent(query));
}
