import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Team, Project, logout, getUserTeams, getGuestNavigation, getMe } from '../services/api';

// 本地存储键名
const STORAGE_KEYS = {
  CURRENT_TEAM_ID: 'navihub_current_team_id',
  IS_EDIT_MODE: 'navihub_is_edit_mode',
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

  const hydrateUser = useCallback(async (u: User) => {
    setUser(u);
    const [t, guest] = await Promise.all([getUserTeams(u.id), getGuestNavigation()]);
    setTeams(t);
    setGuestNavUserId(guest.userId);

    // 恢复保存的团队选择状态
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
      try {
        const me = await getMe();
        if (me && !cancelled) {
          try {
            await hydrateUser(me);
            return;
          } catch {
            if (!cancelled) {
              setUser(null);
              setTeams([]);
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
    await logout();
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
