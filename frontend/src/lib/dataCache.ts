/**
 * 数据缓存服务 - 针对多读少写场景的本地缓存优化
 * 
 * 设计原则：
 * 1. 登录后所有数据缓存到 localStorage，减少服务器压力
 * 2. 优先从缓存读取展示，后台静默刷新
 * 3. 数据变更时先更新服务器，成功后更新缓存
 * 4. 缓存有过期时间，避免数据长期不一致
 */

import { NavLink, NavGroup, Project, Team } from '../services/api';

// 缓存键名前缀
const CACHE_PREFIX = 'navihub_cache_';

// 缓存过期时间（默认 24 小时）
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

// 缓存数据类型
export interface CacheData<T> {
  data: T;
  timestamp: number;
  version: number;
}

// 缓存键名定义
export const CacheKeys = {
  LINKS: (context: { userId?: number; teamId?: string }) => {
    if (context.teamId) return `${CACHE_PREFIX}links_team_${context.teamId}`;
    if (context.userId) return `${CACHE_PREFIX}links_user_${context.userId}`;
    return `${CACHE_PREFIX}links_guest`;
  },
  GROUPS: (context: { userId?: number; teamId?: string }) => {
    if (context.teamId) return `${CACHE_PREFIX}groups_team_${context.teamId}`;
    if (context.userId) return `${CACHE_PREFIX}groups_user_${context.userId}`;
    return `${CACHE_PREFIX}groups_guest`;
  },
  PROJECTS: (teamId: string) => `${CACHE_PREFIX}projects_${teamId}`,
  TEAMS: (userId: number) => `${CACHE_PREFIX}teams_${userId}`,
  GUEST_NAV: () => `${CACHE_PREFIX}guest_nav`,
  USER: () => `${CACHE_PREFIX}current_user`,
} as const;

/**
 * 写入缓存
 */
export function setCache<T>(key: string, data: T): void {
  try {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now(),
      version: 1,
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch {
    // 忽略 localStorage 写入错误（如存储空间不足）
    console.warn('Failed to write cache:', key);
  }
}

/**
 * 读取缓存
 */
export function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const cacheData: CacheData<T> = JSON.parse(cached);
    return cacheData.data;
  } catch {
    return null;
  }
}

/**
 * 读取缓存（带过期检查）
 */
export function getCacheWithExpiry<T>(key: string, ttl: number = DEFAULT_CACHE_TTL): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const cacheData: CacheData<T> = JSON.parse(cached);
    const now = Date.now();
    
    // 检查是否过期
    if (now - cacheData.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    
    return cacheData.data;
  } catch {
    return null;
  }
}

/**
 * 清除指定缓存
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * 清除所有导航相关缓存
 */
export function clearAllNavCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/**
 * 清除指定用户的所有缓存
 */
export function clearUserCache(userId: number): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes(`_user_${userId}`) || key?.includes(`_teams_${userId}`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/**
 * 清除指定团队的所有缓存
 */
export function clearTeamCache(teamId: string): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes(`_team_${teamId}`) || key?.includes(`_projects_${teamId}`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

// ==================== 便捷缓存方法 ====================

/**
 * 缓存链接数据
 */
export function cacheLinks(context: { userId?: number; teamId?: string }, links: NavLink[]): void {
  const key = CacheKeys.LINKS(context);
  setCache(key, links);
}

/**
 * 获取缓存的链接数据
 */
export function getCachedLinks(context: { userId?: number; teamId?: string }): NavLink[] | null {
  const key = CacheKeys.LINKS(context);
  return getCacheWithExpiry(key);
}

/**
 * 缓存分组数据
 */
export function cacheGroups(context: { userId?: number; teamId?: string }, groups: NavGroup[]): void {
  const key = CacheKeys.GROUPS(context);
  setCache(key, groups);
}

/**
 * 获取缓存的分组数据
 */
export function getCachedGroups(context: { userId?: number; teamId?: string }): NavGroup[] | null {
  const key = CacheKeys.GROUPS(context);
  return getCacheWithExpiry(key);
}

/**
 * 缓存项目数据
 */
export function cacheProjects(teamId: string, projects: Project[]): void {
  const key = CacheKeys.PROJECTS(teamId);
  setCache(key, projects);
}

/**
 * 获取缓存的项目数据
 */
export function getCachedProjects(teamId: string): Project[] | null {
  const key = CacheKeys.PROJECTS(teamId);
  return getCacheWithExpiry(key);
}

/**
 * 缓存团队数据
 */
export function cacheTeams(userId: number, teams: Team[]): void {
  const key = CacheKeys.TEAMS(userId);
  setCache(key, teams);
}

/**
 * 获取缓存的团队数据
 */
export function getCachedTeams(userId: number): Team[] | null {
  const key = CacheKeys.TEAMS(userId);
  return getCacheWithExpiry(key);
}

/**
 * 缓存访客导航数据
 */
export function cacheGuestNav(data: { userId: number | null; links: NavLink[]; groups: NavGroup[] }): void {
  const key = CacheKeys.GUEST_NAV();
  setCache(key, data);
}

/**
 * 获取缓存的访客导航数据
 */
export function getCachedGuestNav(): { userId: number | null; links: NavLink[]; groups: NavGroup[] } | null {
  const key = CacheKeys.GUEST_NAV();
  return getCacheWithExpiry(key);
}

// ==================== 当前用户缓存 ====================

import type { User } from '../services/api';

/**
 * 缓存当前用户信息
 */
export function cacheCurrentUser(user: User): void {
  const key = CacheKeys.USER();
  setCache(key, user);
}

/**
 * 获取缓存的当前用户信息
 */
export function getCachedCurrentUser(): User | null {
  const key = CacheKeys.USER();
  return getCacheWithExpiry(key);
}

/**
 * 清除当前用户缓存
 */
export function clearCurrentUserCache(): void {
  const key = CacheKeys.USER();
  clearCache(key);
}

// ==================== 缓存更新方法（用于数据变更后） ====================

/**
 * 更新单个链接到缓存
 */
export function updateLinkInCache(context: { userId?: number; teamId?: string }, link: NavLink): void {
  const cached = getCachedLinks(context);
  if (!cached) return;
  
  const index = cached.findIndex(l => l.id === link.id);
  if (index >= 0) {
    cached[index] = { ...cached[index], ...link };
  } else {
    cached.push(link);
  }
  cacheLinks(context, cached);
}

/**
 * 从缓存中删除链接
 */
export function removeLinkFromCache(context: { userId?: number; teamId?: string }, linkId: string): void {
  const cached = getCachedLinks(context);
  if (!cached) return;
  
  const filtered = cached.filter(l => l.id !== linkId);
  cacheLinks(context, filtered);
}

/**
 * 更新单个分组到缓存
 */
export function updateGroupInCache(context: { userId?: number; teamId?: string }, group: NavGroup): void {
  const cached = getCachedGroups(context);
  if (!cached) return;
  
  const index = cached.findIndex(g => g.id === group.id);
  if (index >= 0) {
    cached[index] = { ...cached[index], ...group };
  } else {
    cached.push(group);
  }
  cacheGroups(context, cached);
}

/**
 * 从缓存中删除分组
 */
export function removeGroupFromCache(context: { userId?: number; teamId?: string }, groupId: string): void {
  const cached = getCachedGroups(context);
  if (!cached) return;
  
  const filtered = cached.filter(g => g.id !== groupId);
  cacheGroups(context, filtered);
}

/**
 * 更新单个项目到缓存
 */
export function updateProjectInCache(teamId: string, project: Project): void {
  const cached = getCachedProjects(teamId);
  if (!cached) return;
  
  const index = cached.findIndex(p => p.id === project.id);
  if (index >= 0) {
    cached[index] = { ...cached[index], ...project };
  } else {
    cached.push(project);
  }
  cacheProjects(teamId, cached);
}

/**
 * 从缓存中删除项目
 */
export function removeProjectFromCache(teamId: string, projectId: string): void {
  const cached = getCachedProjects(teamId);
  if (!cached) return;
  
  const filtered = cached.filter(p => p.id !== projectId);
  cacheProjects(teamId, filtered);
}

/**
 * 更新链接顺序到缓存
 */
export function updateLinksOrderInCache(context: { userId?: number; teamId?: string }, updates: { id: string; order: number; rowNum?: number }[]): void {
  const cached = getCachedLinks(context);
  if (!cached) return;
  
  updates.forEach(update => {
    const link = cached.find(l => l.id === update.id);
    if (link) {
      link.order = update.order;
      if (update.rowNum !== undefined) {
        link.rowNum = update.rowNum;
      }
    }
  });
  
  cacheLinks(context, cached);
}
