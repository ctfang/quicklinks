// API Functions
import {
  cacheLinks,
  cacheGroups,
  cacheProjects,
  cacheTeams,
  cacheGuestNav,
  getCachedLinks,
  getCachedGroups,
  getCachedProjects,
  getCachedTeams,
  getCachedGuestNav,
  updateLinkInCache,
  removeLinkFromCache,
  updateGroupInCache,
  removeGroupFromCache,
  updateProjectInCache,
  removeProjectFromCache,
  updateLinksOrderInCache,
} from '../lib/dataCache';

export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: number;
  role: 'owner' | 'admin' | 'member';
  user: User;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  description?: string;
}

export interface NavLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  clicks: number;
  isPublic: boolean;
  teamId?: string;
  projectId?: string;
  userId?: number;
  groupId?: string;
  displaySize?: 'icon' | 'small' | 'medium' | 'large' | 'list';
  order?: number;
  rowNum?: number;
  bgColor?: string | null;
}

export interface NavGroup {
  id: string;
  name: string;
  userId?: number;
  teamId?: string;
  projectId?: string;
  order: number;
}

export interface WidgetConfig {
  id: string;
  type: 'weather' | 'clock' | 'todo' | 'quote';
  visible: boolean;
  order: number;
  settings?: any;
}

export interface WikiNode {
  id: string;
  teamId: string;
  parentId: string | null;
  type: 'folder' | 'document';
  title: string;
  content: string;
  updatedAt: string;
}

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'API request failed');
  }
  return response.json();
}

/** Go 的 nil 切片会序列化为 JSON null，前端收到后 .filter 会报错 */
function asArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

// Auth
/** 有效 Cookie 时返回当前用户，否则 null（不抛错） */
export const getMe = async (): Promise<User | null> => {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || 'API request failed');
  }
  return res.json() as Promise<User>;
};

export const login = async (email?: string, password?: string): Promise<User> => {
  return fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const register = async (name: string, email: string, password?: string): Promise<User> => {
  return fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
};

/** 忘记密码：未配置 SMTP 时后端返回 503；成功时统一文案防枚举 */
export const requestPasswordReset = async (email: string): Promise<{ message: string }> => {
  return fetchApi('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

/** 使用邮箱 + 邮件中的验证码设置新密码 */
export const confirmPasswordReset = async (
  email: string,
  code: string,
  password: string
): Promise<void> => {
  await fetchApi('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
};

export const logout = async (): Promise<void> => {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
};

/** 登录状态下直接修改密码（需要旧密码验证） */
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  await fetchApi('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
};

// Links
/** 未登录访客：首用户个人链接 + 分组（带缓存） */
export const getGuestNavigation = async (options?: { useCache?: boolean }): Promise<{
  userId: number | null;
  links: NavLink[];
  groups: NavGroup[];
}> => {
  // 优先从缓存读取
  if (options?.useCache !== false) {
    const cached = getCachedGuestNav();
    if (cached) {
      return cached;
    }
  }
  
  const data = await fetchApi<{
    userId: number | null;
    links: NavLink[];
    groups: NavGroup[];
  }>('/navigation/guest');
  const result = {
    userId: data.userId ?? null,
    links: asArray(data.links),
    groups: asArray(data.groups),
  };
  
  // 写入缓存
  cacheGuestNav(result);
  return result;
};

export const getPopularLinks = async (): Promise<NavLink[]> => {
  return asArray(await fetchApi<NavLink[]>('/links/popular'));
};

/** 获取个人链接（带缓存） */
export const getPersonalLinksWithCache = async (userId: number, options?: { useCache?: boolean }): Promise<NavLink[]> => {
  // 优先从缓存读取
  if (options?.useCache !== false) {
    const cached = getCachedLinks({ userId });
    if (cached) {
      return cached;
    }
  }
  
  const links = asArray(await fetchApi<NavLink[]>(`/links/personal/${userId}`));
  cacheLinks({ userId }, links);
  return links;
};

export const getPersonalLinks = async (userId: number): Promise<NavLink[]> => {
  return asArray(await fetchApi<NavLink[]>(`/links/personal/${userId}`));
};

/** 获取团队链接（带缓存） */
export const getTeamLinksWithCache = async (teamId: string, options?: { useCache?: boolean }): Promise<NavLink[]> => {
  // 优先从缓存读取
  if (options?.useCache !== false) {
    const cached = getCachedLinks({ teamId });
    if (cached) {
      return cached;
    }
  }
  
  const links = asArray(await fetchApi<NavLink[]>(`/links/team/${teamId}`));
  cacheLinks({ teamId }, links);
  return links;
};

export const getTeamLinks = async (teamId: string): Promise<NavLink[]> => {
  return asArray(await fetchApi<NavLink[]>(`/links/team/${teamId}`));
};

/** 添加链接（更新缓存） */
export const addLinkWithCache = async (link: Omit<NavLink, 'id' | 'clicks'>, context: { userId?: number; teamId?: string }): Promise<NavLink> => {
  const newLink = await fetchApi<NavLink>('/links', {
    method: 'POST',
    body: JSON.stringify(link),
  });
  // 更新缓存
  updateLinkInCache(context, newLink);
  return newLink;
};

/** 更新链接（更新缓存） */
export const updateLinkWithCache = async (id: string, updates: Partial<NavLink>, context: { userId?: number; teamId?: string }): Promise<NavLink> => {
  const updatedLink = await fetchApi<NavLink>(`/links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  // 更新缓存
  updateLinkInCache(context, updatedLink);
  return updatedLink;
};

/** 删除链接（更新缓存） */
export const deleteLinkWithCache = async (id: string, context: { userId?: number; teamId?: string }): Promise<void> => {
  await fetchApi(`/links/${id}`, { method: 'DELETE' });
  // 更新缓存
  removeLinkFromCache(context, id);
};

/** 批量更新链接顺序（更新缓存） */
export const updateLinksOrderWithCache = async (links: { id: string; order: number; rowNum?: number }[], context: { userId?: number; teamId?: string }): Promise<void> => {
  // 使用 Promise.all 并行更新所有链接的顺序
  await Promise.all(
    links.map(link => fetchApi(`/links/${link.id}`, {
      method: 'PUT',
      body: JSON.stringify({ order: link.order, rowNum: link.rowNum }),
    }))
  );
  // 更新缓存
  updateLinksOrderInCache(context, links);
};

export const addLink = async (link: Omit<NavLink, 'id' | 'clicks'>): Promise<NavLink> => {
  return fetchApi('/links', {
    method: 'POST',
    body: JSON.stringify(link),
  });
};

export const updateLink = async (id: string, updates: Partial<NavLink>): Promise<NavLink> => {
  return fetchApi(`/links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/** 批量更新链接顺序 */
export const updateLinksOrder = async (links: { id: string; order: number }[]): Promise<void> => {
  // 使用 Promise.all 并行更新所有链接的顺序
  await Promise.all(
    links.map(link => fetchApi(`/links/${link.id}`, {
      method: 'PUT',
      body: JSON.stringify({ order: link.order }),
    }))
  );
};

export const deleteLink = async (id: string): Promise<void> => {
  return fetchApi(`/links/${id}`, { method: 'DELETE' });
};

export const searchLinks = async (query: string, context?: { userId?: number, teamId?: string }): Promise<NavLink[]> => {
  let links: NavLink[] = [];
  if (context?.teamId) {
    links = await getTeamLinks(context.teamId);
  } else if (context?.userId) {
    links = await getPersonalLinks(context.userId);
  } else {
    links = await getPopularLinks();
  }
  
  const q = query.toLowerCase();
  return asArray(links).filter(l => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
};

// Groups
/** 获取分组（带缓存） */
export const getGroupsWithCache = async (context: { userId?: number; teamId?: string; projectId?: string }, options?: { useCache?: boolean }): Promise<NavGroup[]> => {
  const params = new URLSearchParams();
  if (context.projectId) params.append('projectId', context.projectId);
  if (context.teamId) params.append('teamId', context.teamId);
  if (context.userId != null) params.append('userId', String(context.userId));
  
  // 优先从缓存读取（仅当没有 projectId 过滤时，因为缓存是按 user/team 维度）
  if (options?.useCache !== false && !context.projectId) {
    const cached = getCachedGroups({ userId: context.userId, teamId: context.teamId });
    if (cached) {
      // 如果有过滤条件，在缓存中过滤
      if (context.projectId) {
        return cached.filter(g => g.projectId === context.projectId);
      }
      return cached;
    }
  }
  
  const groups = asArray(await fetchApi<NavGroup[]>(`/groups?${params.toString()}`));
  
  // 写入缓存（仅当没有 projectId 过滤时）
  if (!context.projectId) {
    cacheGroups({ userId: context.userId, teamId: context.teamId }, groups);
  }
  
  return groups;
};

export const getGroups = async (context: { userId?: number, teamId?: string, projectId?: string }): Promise<NavGroup[]> => {
  const params = new URLSearchParams();
  if (context.projectId) params.append('projectId', context.projectId);
  if (context.teamId) params.append('teamId', context.teamId);
  if (context.userId != null) params.append('userId', String(context.userId));
  return asArray(await fetchApi<NavGroup[]>(`/groups?${params.toString()}`));
};

/** 添加分组（更新缓存） */
export const addGroupWithCache = async (group: Omit<NavGroup, 'id'>, context: { userId?: number; teamId?: string }): Promise<NavGroup> => {
  const newGroup = await fetchApi<NavGroup>('/groups', {
    method: 'POST',
    body: JSON.stringify(group),
  });
  updateGroupInCache(context, newGroup);
  return newGroup;
};

export const addGroup = async (group: Omit<NavGroup, 'id'>): Promise<NavGroup> => {
  return fetchApi('/groups', {
    method: 'POST',
    body: JSON.stringify(group),
  });
};

/** 更新分组（更新缓存） */
export const updateGroupWithCache = async (id: string, updates: Partial<NavGroup>, context: { userId?: number; teamId?: string }): Promise<NavGroup> => {
  const updatedGroup = await fetchApi<NavGroup>(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  updateGroupInCache(context, updatedGroup);
  return updatedGroup;
};

export const updateGroup = async (id: string, updates: Partial<NavGroup>): Promise<NavGroup> => {
  return fetchApi(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/** 删除分组（更新缓存） */
export const deleteGroupWithCache = async (id: string, context: { userId?: number; teamId?: string }): Promise<void> => {
  await fetchApi(`/groups/${id}`, { method: 'DELETE' });
  removeGroupFromCache(context, id);
};

export const deleteGroup = async (id: string): Promise<void> => {
  return fetchApi(`/groups/${id}`, { method: 'DELETE' });
};

export const getPersonalGroups = async (userId: number): Promise<NavGroup[]> => {
  return getGroups({ userId });
};

// Teams & Projects
/** 获取用户团队（带缓存） */
export const getUserTeamsWithCache = async (userId: number, options?: { useCache?: boolean }): Promise<Team[]> => {
  // 优先从缓存读取
  if (options?.useCache !== false) {
    const cached = getCachedTeams(userId);
    if (cached) {
      return cached;
    }
  }
  
  const teams = asArray(await fetchApi<Team[]>(`/teams/user/${userId}`));
  cacheTeams(userId, teams);
  return teams;
};

export const getUserTeams = async (userId: number): Promise<Team[]> => {
  return asArray(await fetchApi<Team[]>(`/teams/user/${userId}`));
};

export const createTeam = async (name: string, description: string, ownerId: number): Promise<Team> => {
  return fetchApi('/teams', {
    method: 'POST',
    body: JSON.stringify({ name, description, ownerId }),
  });
};

export const updateTeam = async (id: string, updates: Partial<Pick<Team, 'name' | 'description'>>): Promise<Team> => {
  return fetchApi<Team>(`/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

export const deleteTeam = async (id: string): Promise<void> => {
  return fetchApi(`/teams/${id}`, { method: 'DELETE' });
};

export const getTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
  return asArray(await fetchApi<TeamMember[]>(`/teams/${teamId}/members`));
};

export const addTeamMember = async (teamId: string, email: string): Promise<TeamMember> => {
  return fetchApi(`/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const removeTeamMember = async (memberId: string): Promise<void> => {
  return fetchApi(`/team-members/${memberId}`, { method: 'DELETE' });
};

/** 获取团队项目（带缓存） */
export const getTeamProjectsWithCache = async (teamId: string, options?: { useCache?: boolean }): Promise<Project[]> => {
  // 优先从缓存读取
  if (options?.useCache !== false) {
    const cached = getCachedProjects(teamId);
    if (cached) {
      return cached;
    }
  }
  
  const projects = asArray(await fetchApi<Project[]>(`/projects/team/${teamId}`));
  cacheProjects(teamId, projects);
  return projects;
};

export const getTeamProjects = async (teamId: string): Promise<Project[]> => {
  return asArray(await fetchApi<Project[]>(`/projects/team/${teamId}`));
};

/** 添加项目（更新缓存） */
export const addProjectWithCache = async (teamId: string, name: string, description: string): Promise<Project> => {
  const newProject = await fetchApi<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify({ teamId, name, description }),
  });
  updateProjectInCache(teamId, newProject);
  return newProject;
};

export const addProject = async (teamId: string, name: string, description: string): Promise<Project> => {
  return fetchApi('/projects', {
    method: 'POST',
    body: JSON.stringify({ teamId, name, description }),
  });
};

/** 更新项目（更新缓存） */
export const updateProjectWithCache = async (id: string, updates: Partial<Project>, teamId: string): Promise<Project> => {
  const updatedProject = await fetchApi<Project>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  updateProjectInCache(teamId, updatedProject);
  return updatedProject;
};

export const updateProject = async (id: string, updates: Partial<Project>): Promise<Project> => {
  return fetchApi(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/** 删除项目（更新缓存） */
export const deleteProjectWithCache = async (id: string, teamId: string): Promise<void> => {
  await fetchApi(`/projects/${id}`, { method: 'DELETE' });
  removeProjectFromCache(teamId, id);
};

export const deleteProject = async (id: string): Promise<void> => {
  return fetchApi(`/projects/${id}`, { method: 'DELETE' });
};

// Widgets
export const getUserWidgets = async (userId: number): Promise<WidgetConfig[]> => {
  return asArray(await fetchApi<WidgetConfig[]>(`/widgets/user/${userId}`));
};

export const updateWidgetConfig = async (userId: number, widgets: WidgetConfig[]): Promise<void> => {
  return fetchApi(`/widgets/user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(widgets),
  });
};

// Wiki
export const getTeamWikiNodes = async (teamId: string): Promise<WikiNode[]> => {
  return asArray(await fetchApi<WikiNode[]>(`/wiki/team/${teamId}`));
};

export const createWikiNode = async (teamId: string, parentId: string | null, type: 'folder' | 'document', title: string): Promise<WikiNode> => {
  return fetchApi('/wiki', {
    method: 'POST',
    body: JSON.stringify({ teamId, parentId, type, title }),
  });
};

export const updateWikiNode = async (id: string, updates: Partial<WikiNode>): Promise<WikiNode> => {
  return fetchApi(`/wiki/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

export const deleteWikiNode = async (id: string): Promise<void> => {
  return fetchApi(`/wiki/${id}`, { method: 'DELETE' });
};

// Weather - 从后端服务获取，支持缓存
export interface WeatherInfo {
  code?: number;
  weather1: string;
  temperature: number;
  place: string;
  humidity?: number;
  wind?: string;
  error?: string;
}

export interface WeatherLocationInfo {
  province: string;
  city: string;
  adcode: string;
  error?: string;
}

export const getWeather = async (city = '深圳', province = '广东', adcode = ''): Promise<WeatherInfo> => {
  let url = `/weather?city=${encodeURIComponent(city)}&province=${encodeURIComponent(province)}`;
  if (adcode) {
    url += `&adcode=${encodeURIComponent(adcode)}`;
  }
  return fetchApi<WeatherInfo>(url);
};

export const getWeatherLocation = async (): Promise<WeatherLocationInfo> => {
  return fetchApi<WeatherLocationInfo>('/weather/location');
};
