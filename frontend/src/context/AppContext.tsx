import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Team, Project, logout, getUserTeamsWithCache, getGuestNavigation, getMe, getWeather, WeatherInfo } from '../services/api';
import {
  DEFAULT_WEATHER_LOCATION,
  readWeatherLocationFromStorage,
  writeWeatherLocationToStorage,
  type WeatherLocation,
} from '../lib/weatherLocation';
import {
  DEFAULT_SEARCH_ENGINE,
  readSearchEngineFromStorage,
  writeSearchEngineToStorage,
  type SearchEngine,
} from '../lib/searchEngine';
import { clearUserCache, cacheCurrentUser, getCachedCurrentUser, clearCurrentUserCache } from '../lib/dataCache';

// 本地存储键名
const STORAGE_KEYS = {
  CURRENT_TEAM_ID: 'navihub_current_team_id',
  IS_EDIT_MODE: 'navihub_is_edit_mode',
  /** 曾成功建立会话时置位；无此项时不请求 /api/auth/me，避免访客首屏多余请求 */
  SESSION_HINT: 'navihub_session_hint',
};

interface AppContextType {
  user: User | null;
  /** 与访客首页数据源为同一用户（库中 id 排序首条）时视为管理员 */
  isAdmin: boolean;
  isLoading: boolean;
  teams: Team[];
  currentTeam: Team | null;
  currentProject: Project | null;
  /** 访客首页数据源用户 id（users 表按 id 升序第一条），未登录时搜索等沿用 */
  guestNavUserId: number | null;
  setGuestNavUserId: (id: number | null) => void;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  loginUser: (u: User) => Promise<void>;
  logoutUser: () => Promise<void>;
  setCurrentTeam: (team: Team | null) => void;
  setCurrentProject: (project: Project | null) => void;
  /** 天气展示用省、市，持久化在浏览器 localStorage，默认广东/深圳 */
  weatherLocation: WeatherLocation;
  setWeatherLocation: (loc: WeatherLocation) => void;
  /** 搜索引擎设置，持久化在浏览器 localStorage，默认百度 */
  searchEngine: SearchEngine;
  setSearchEngine: (engine: SearchEngine) => void;
  /** 当前天气数据，全局共享避免重复请求 */
  currentWeather: WeatherInfo | null;
  /** 刷新天气数据 */
  refreshWeather: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeamState] = useState<Team | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isEditMode, setIsEditModeState] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [guestNavUserId, setGuestNavUserId] = useState<number | null>(null);
  const [weatherLocation, setWeatherLocationState] = useState<WeatherLocation>(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_WEATHER_LOCATION };
    return readWeatherLocationFromStorage();
  });
  const [searchEngine, setSearchEngineState] = useState<SearchEngine>(() => {
    if (typeof window === 'undefined') return DEFAULT_SEARCH_ENGINE;
    return readSearchEngineFromStorage();
  });
  const [currentWeather, setCurrentWeather] = useState<WeatherInfo | null>(null);

  // 刷新天气数据
  const refreshWeather = useCallback(async () => {
    try {
      const data = await getWeather(weatherLocation.city, weatherLocation.province);
      setCurrentWeather(data);
    } catch (err) {
      console.error('Failed to fetch weather', err);
      setCurrentWeather({
        weather1: '晴',
        temperature: 22,
        place: weatherLocation.city,
      });
    }
  }, [weatherLocation.city, weatherLocation.province]);

  // 天气位置变化时自动刷新天气
  useEffect(() => {
    refreshWeather();
  }, [refreshWeather]);

  const setWeatherLocation = useCallback((loc: WeatherLocation) => {
    const province =
      loc.province.trim() !== '' ? loc.province.trim() : DEFAULT_WEATHER_LOCATION.province;
    const city = loc.city.trim() !== '' ? loc.city.trim() : DEFAULT_WEATHER_LOCATION.city;
    const next = { province, city };
    setWeatherLocationState(next);
    writeWeatherLocationToStorage(next);
  }, []);

  const setSearchEngine = useCallback((engine: SearchEngine) => {
    setSearchEngineState(engine);
    writeSearchEngineToStorage(engine);
  }, []);

  // 从 localStorage 读取保存的状态
  useEffect(() => {
    try {
      const savedEditMode = localStorage.getItem(STORAGE_KEYS.IS_EDIT_MODE);
      if (savedEditMode !== null) {
        setIsEditModeState(savedEditMode === 'true');
      }
    } catch {
      // 忽略 localStorage 读取错误
    }
  }, []);

  // 包装 setIsEditMode，同时保存到 localStorage
  const setIsEditMode = useCallback((mode: boolean) => {
    setIsEditModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEYS.IS_EDIT_MODE, String(mode));
    } catch {
      // 忽略 localStorage 写入错误
    }
  }, []);

  // 包装 setCurrentTeam，同时保存到 localStorage
  const setCurrentTeam = useCallback((team: Team | null) => {
    setCurrentTeamState(team);
    try {
      if (team) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_TEAM_ID, team.id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_TEAM_ID);
      }
    } catch {
      // 忽略 localStorage 写入错误
    }
  }, []);

  const hydrateUser = useCallback(async (u: User, fromCache: boolean = false) => {
    setUser(u);
    
    // 缓存用户信息（如果是从服务器获取的）
    if (!fromCache) {
      try {
        localStorage.setItem(STORAGE_KEYS.SESSION_HINT, '1');
        cacheCurrentUser(u);
      } catch {
        // ignore
      }
    }
    
    // 缓存优先：尝试从缓存获取团队数据
    const cachedTeams = await getUserTeamsWithCache(u.id, { useCache: true });
    if (cachedTeams) {
      setTeams(cachedTeams);
      
      // 恢复保存的团队选择状态
      try {
        const savedTeamId = localStorage.getItem(STORAGE_KEYS.CURRENT_TEAM_ID);
        if (savedTeamId) {
          const savedTeam = cachedTeams.find(team => team.id === savedTeamId);
          if (savedTeam) {
            setCurrentTeamState(savedTeam);
          }
        }
      } catch {
        // 忽略 localStorage 读取错误
      }
      return; // 有缓存，直接返回，不请求服务器
    }
    
    // 无缓存，请求服务器
    const [t, guest] = await Promise.all([getUserTeamsWithCache(u.id, { useCache: false }), getGuestNavigation()]);
    setTeams(t);
    setGuestNavUserId(guest.userId);

    // 恢复团队选择状态
    try {
      const savedTeamId = localStorage.getItem(STORAGE_KEYS.CURRENT_TEAM_ID);
      if (savedTeamId) {
        const savedTeam = t.find(team => team.id === savedTeamId);
        if (savedTeam) {
          setCurrentTeamState(savedTeam);
        }
      }
    } catch {
      // 忽略 localStorage 读取错误
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setIsLoading(true);
      let hasSessionHint = false;
      try {
        hasSessionHint = localStorage.getItem(STORAGE_KEYS.SESSION_HINT) === '1';
      } catch {
        hasSessionHint = false;
      }
      try {
        if (hasSessionHint) {
          // 缓存优先：先尝试从缓存获取用户信息
          const cachedUser = getCachedCurrentUser();
          if (cachedUser && !cancelled) {
            // 使用缓存的用户信息，不请求 /api/auth/me
            await hydrateUser(cachedUser, true);
            return;
          }
          
          // 无缓存，请求服务器
          const me = await getMe();
          if (!me) {
            try {
              localStorage.removeItem(STORAGE_KEYS.SESSION_HINT);
              clearCurrentUserCache();
            } catch {
              // ignore
            }
          } else if (!cancelled) {
            try {
              await hydrateUser(me, false);
              return;
            } catch {
              if (!cancelled) {
                setUser(null);
                setTeams([]);
              }
            }
          }
        }
        const g = await getGuestNavigation();
        if (!cancelled) setGuestNavUserId(g.userId);
      } catch {
        if (!cancelled) setGuestNavUserId(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [hydrateUser]);

  const loginUser = async (u: User) => {
    setIsLoading(true);
    try {
      await hydrateUser(u);
    } finally {
      setIsLoading(false);
    }
  };

  const logoutUser = async () => {
    setIsLoading(true);
    
    // 清除用户相关缓存
    if (user) {
      clearUserCache(user.id);
    }
    clearCurrentUserCache();
    
    await logout();
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION_HINT);
    } catch {
      // ignore
    }
    setUser(null);
    setTeams([]);
    setCurrentTeamState(null);
    setCurrentProject(null);
    setIsEditModeState(false);
    // 清除本地存储的状态
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_TEAM_ID);
      localStorage.removeItem(STORAGE_KEYS.IS_EDIT_MODE);
    } catch {
      // 忽略 localStorage 错误
    }
    try {
      const g = await getGuestNavigation();
      setGuestNavUserId(g.userId);
    } catch {
      setGuestNavUserId(null);
    }
    setIsLoading(false);
  };

  const isAdmin = Boolean(user && guestNavUserId && user.id === guestNavUserId);

  return (
    <AppContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        teams,
        currentTeam,
        currentProject,
        guestNavUserId,
        setGuestNavUserId,
        isEditMode,
        setIsEditMode,
        isSettingsOpen,
        setIsSettingsOpen,
        loginUser,
        logoutUser,
        setCurrentTeam,
        setCurrentProject,
        weatherLocation,
        setWeatherLocation,
        searchEngine,
        setSearchEngine,
        currentWeather,
        refreshWeather,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
