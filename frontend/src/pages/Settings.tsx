import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getUserWidgets, updateWidgetConfig, WidgetConfig, getTeamMembers, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, TeamMember, changePassword } from '../services/api';
import { clearAllNavCache } from '../lib/dataCache';
import { Save, User as UserIcon, LayoutDashboard, Users, Plus, X, UserPlus, Trash2, Edit2, Lock, Eye, EyeOff, Search, Cloud, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { md5Hex } from '../lib/passwordHash';
import { cn } from '../lib/utils';
import { ConfirmModal } from '../components/ConfirmModal';
import { SEARCH_ENGINES, SearchEngine } from '../lib/searchEngine';

export const Settings = () => {
  const {
    user,
    teams,
    loginUser,
    isEditMode,
    setIsEditMode,
    isSettingsOpen,
    setIsSettingsOpen,
    isAdmin,
    weatherLocation,
    setWeatherLocation,
    searchEngine,
    setSearchEngine,
  } = useAppContext();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'widgets' | 'teams' | 'search' | 'weather' | 'security' | 'sync'>('profile');

  // Team Management State
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  
  // Edit Team State
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');

  // Change Password State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [weatherProvinceDraft, setWeatherProvinceDraft] = useState(weatherLocation.province);
  const [weatherCityDraft, setWeatherCityDraft] = useState(weatherLocation.city);

  // Cache Refresh State
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  // Confirm Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (user && isSettingsOpen) {
      getUserWidgets(user.id).then(setWidgets);
    }
  }, [user, isSettingsOpen]);

  useEffect(() => {
    if (isSettingsOpen) {
      setWeatherProvinceDraft(weatherLocation.province);
      setWeatherCityDraft(weatherLocation.city);
    }
  }, [isSettingsOpen, weatherLocation.province, weatherLocation.city]);

  useEffect(() => {
    if (selectedTeamId && isSettingsOpen) {
      getTeamMembers(selectedTeamId).then(setTeamMembers);
    }
  }, [selectedTeamId, isSettingsOpen]);

  const handleToggleWidget = (id: string) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const handleSave = async () => {
    if (user) {
      setIsSaving(true);
      await updateWidgetConfig(user.id, widgets);
      setIsSaving(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && newTeamName) {
      await createTeam(newTeamName, newTeamDesc, user.id);
      await loginUser(user); // Refresh teams
      setIsCreatingTeam(false);
      setNewTeamName('');
      setNewTeamDesc('');
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && editingTeamId && editTeamName) {
      await updateTeam(editingTeamId, { name: editTeamName, description: editTeamDesc });
      await loginUser(user); // Refresh teams
      setEditingTeamId(null);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除团队',
      message: '确定要删除这个团队吗？此操作不可恢复，且会删除团队下的所有项目和链接。',
      onConfirm: async () => {
        await deleteTeam(teamId);
        if (user) {
          await loginUser(user); // Refresh teams
        }
      }
    });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeamId && newMemberEmail) {
      try {
        await addTeamMember(selectedTeamId, newMemberEmail);
        const members = await getTeamMembers(selectedTeamId);
        setTeamMembers(members);
        setNewMemberEmail('');
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '移除成员',
      message: '确定要移除该成员吗？',
      onConfirm: async () => {
        await removeTeamMember(memberId);
        if (selectedTeamId) {
          const members = await getTeamMembers(selectedTeamId);
          setTeamMembers(members);
        }
      }
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    try {
      const oldHash = md5Hex(oldPassword);
      const newHash = md5Hex(newPassword);
      await changePassword(oldHash, newHash);
      setPasswordSuccess('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || '修改失败，请检查旧密码是否正确');
    }
  };

  const cancelChangePassword = () => {
    setIsChangingPassword(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  // 处理刷新缓存
  const handleRefreshCache = async () => {
    setIsRefreshingCache(true);
    setRefreshMessage('');
    
    try {
      // 清除所有导航缓存
      clearAllNavCache();
      
      // 刷新页面以重新加载数据
      setRefreshMessage('缓存已清除，正在刷新页面...');
      
      // 延迟一下让用户看到提示
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setRefreshMessage('刷新失败，请重试');
      setIsRefreshingCache(false);
    }
  };

  if (!isSettingsOpen) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
        <div className="relative bg-slate-900/95 backdrop-blur-xl p-8 rounded-3xl border border-white/20 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-xl font-medium mb-2 text-white">请先登录</h2>
          <p className="text-white/70 mb-6">您需要登录才能访问设置页面</p>
          <button 
            onClick={() => setIsSettingsOpen(false)}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <h1 className="text-2xl font-bold text-white">设置</h1>
          <button 
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* Sidebar */}
            <div className="w-full md:w-64 flex-shrink-0">
              <nav className="flex flex-col gap-2">
            <button
              onClick={() => { setActiveTab('profile'); setSelectedTeamId(null); }}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium", activeTab === 'profile' ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <UserIcon size={18} />
              个人资料
            </button>
            <button
              onClick={() => { setActiveTab('search'); setSelectedTeamId(null); }}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium", activeTab === 'search' ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <Search size={18} />
              搜索引擎
            </button>
            <button
              onClick={() => { setActiveTab('weather'); setSelectedTeamId(null); }}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium", activeTab === 'weather' ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <Cloud size={18} />
              天气城市
            </button>
            <button
              onClick={() => { setActiveTab('security'); setSelectedTeamId(null); }}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium", activeTab === 'security' ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <Shield size={18} />
              安全设置
            </button>
            <button
              onClick={() => { setActiveTab('sync'); setSelectedTeamId(null); }}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium", activeTab === 'sync' ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <RefreshCw size={18} />
              数据同步
            </button>
            <button
              onClick={() => { setActiveTab('widgets'); setSelectedTeamId(null); }}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium", activeTab === 'widgets' ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <LayoutDashboard size={18} />
              小组件设置
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium", activeTab === 'teams' ? "bg-white/20 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              <Users size={18} />
              我的团队
            </button>
          </nav>
        </div>

            {/* Content */}
            <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 min-h-[500px]">
          {activeTab === 'profile' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-medium border-b border-white/10 pb-4 mb-6">个人资料</h2>
                <div className="flex items-center gap-6">
                  <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full border-4 border-white/20 bg-white" />
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2 flex-wrap">
                      {user.name}
                      {isAdmin && (
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                          管理员
                        </span>
                      )}
                    </h3>
                    <p className="text-white/60">{user.email}</p>
                    {isAdmin && (
                      <p className="text-sm text-white/50 mt-2 max-w-md">
                        您是当前用于访客首页展示的那位用户（按用户 id 排序的第一条账号）。未登录访客看到的首页即您「个人空间」下的链接与分组；请在首页开启「管理导航模式」后编辑。
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-medium border-b border-white/10 pb-4 mb-6">偏好设置</h2>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <h3 className="font-medium">管理导航模式</h3>
                    <p className="text-sm text-white/60 mt-1">
                      {isAdmin
                        ? '开启后可在首页编辑链接与分组；您「个人空间」中的内容会同步展示给未登录访客。'
                        : '开启后可在首页编辑您自己的个人导航；未登录访客首页由管理员账号维护。'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isEditMode}
                      onChange={(e) => setIsEditMode(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-xl font-medium">搜索引擎</h2>
              </div>
              <p className="text-sm text-white/60">
                选择默认的搜索引擎，将用于首页搜索栏的网页搜索功能。
              </p>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 max-w-md">
                {SEARCH_ENGINES.map((engine) => (
                  <label
                    key={engine.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                      searchEngine.id === engine.id
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    )}
                  >
                    <input
                      type="radio"
                      name="searchEngine"
                      value={engine.id}
                      checked={searchEngine.id === engine.id}
                      onChange={() => setSearchEngine(engine)}
                      className="sr-only"
                    />
                    <img
                      src={engine.icon}
                      alt={engine.name}
                      className="w-5 h-5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="flex-1 text-white">{engine.name}</span>
                    {searchEngine.id === engine.id && (
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-xl font-medium">天气城市</h2>
              </div>
              <p className="text-sm text-white/60">
                默认广东 / 深圳；可改为其他城市，将保存在本浏览器并用于顶部天气与背景。
              </p>
              <form
                className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4 max-w-md"
                onSubmit={(e) => {
                  e.preventDefault();
                  setWeatherLocation({
                    province: weatherProvinceDraft,
                    city: weatherCityDraft,
                  });
                }}
              >
                <div>
                  <label htmlFor="settings-weather-province" className="block text-sm text-white/80 mb-1">
                    省份
                  </label>
                  <input
                    id="settings-weather-province"
                    type="text"
                    value={weatherProvinceDraft}
                    onChange={(e) => setWeatherProvinceDraft(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="广东"
                  />
                </div>
                <div>
                  <label htmlFor="settings-weather-city" className="block text-sm text-white/80 mb-1">
                    城市
                  </label>
                  <input
                    id="settings-weather-city"
                    type="text"
                    value={weatherCityDraft}
                    onChange={(e) => setWeatherCityDraft(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="深圳"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  保存天气城市
                </button>
              </form>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-xl font-medium">数据同步</h2>
              </div>
              
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200/80">
                  <p className="font-medium text-amber-200 mb-1">多设备同步提示</p>
                  <p>如果您在多台电脑登录同一账号，本地缓存可能导致数据不同步。当其他设备添加了新的导航链接或分组时，您需要点击下方的「刷新缓存」按钮才能看到最新数据。</p>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <RefreshCw size={24} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">刷新本地缓存</h3>
                    <p className="text-sm text-white/60 mt-1">
                      清除本地缓存并从服务器重新获取最新数据。适用于：
                    </p>
                    <ul className="text-sm text-white/60 mt-2 space-y-1 list-disc list-inside">
                      <li>在其他设备上添加了新的导航链接</li>
                      <li>分组顺序或链接排序发生变化</li>
                      <li>发现数据显示异常或缺失</li>
                    </ul>
                  </div>
                </div>

                {refreshMessage && (
                  <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-200 text-sm">
                    {refreshMessage}
                  </div>
                )}

                <button
                  onClick={handleRefreshCache}
                  disabled={isRefreshingCache}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-5 py-3 rounded-xl font-medium transition-colors"
                >
                  <RefreshCw size={18} className={isRefreshingCache ? 'animate-spin' : ''} />
                  {isRefreshingCache ? '刷新中...' : '刷新缓存'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-medium text-white mb-3">缓存工作原理</h3>
                <div className="space-y-2 text-sm text-white/60">
                  <p>1. 登录后，您的导航数据会自动缓存到浏览器本地存储</p>
                  <p>2. 下次访问时，优先从缓存加载，页面展示更快</p>
                  <p>3. 后台会自动同步服务器最新数据</p>
                  <p>4. 缓存有效期为 24 小时，过期后会自动重新获取</p>
                  <p>5. 登出时会自动清除当前用户的缓存数据</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-xl font-medium">安全设置</h2>
              </div>
              <div>
                {!isChangingPassword ? (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Lock size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium">修改密码</h3>
                        <p className="text-sm text-white/60 mt-1">定期更换密码可以提高账号安全性</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                    >
                      修改
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4 max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Lock size={20} className="text-blue-400" />
                      </div>
                      <h3 className="font-medium">修改密码</h3>
                    </div>

                    {passwordError && (
                      <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
                        {passwordError}
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-200 text-sm">
                        {passwordSuccess}
                      </div>
                    )}

                    <div className="relative">
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        placeholder="当前密码"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 pr-10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      >
                        {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="新密码（至少 6 位）"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 pr-10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="确认新密码"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 pr-10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={cancelChangePassword}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl font-medium transition-colors"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors"
                      >
                        确认修改
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {activeTab === 'widgets' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-xl font-medium">小组件设置</h2>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSaving ? '保存中...' : '保存更改'}
                </button>
              </div>
              <div className="space-y-4">
                {widgets.map(widget => (
                  <div key={widget.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <h3 className="font-medium capitalize">{widget.type === 'weather' ? '天气' : widget.type === 'clock' ? '时钟' : widget.type === 'todo' ? '待办事项' : '每日格言'}</h3>
                      <p className="text-sm text-white/60 mt-1">在首页显示此小组件</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={widget.visible}
                        onChange={() => handleToggleWidget(widget.id)}
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-xl font-medium">
                  {selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '我的团队'}
                </h2>
                {!selectedTeamId ? (
                  <button 
                    onClick={() => setIsCreatingTeam(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    创建团队
                  </button>
                ) : (
                  <button 
                    onClick={() => setSelectedTeamId(null)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  >
                    返回列表
                  </button>
                )}
              </div>

              {isCreatingTeam ? (
                <form onSubmit={handleCreateTeam} className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">创建新团队</h3>
                    <button type="button" onClick={() => setIsCreatingTeam(false)} className="text-white/50 hover:text-white"><X size={18} /></button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="团队名称" 
                    required
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                  <input 
                    type="text" 
                    placeholder="团队描述" 
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-medium transition-colors">
                    确认创建
                  </button>
                </form>
              ) : selectedTeamId ? (
                <div className="space-y-6">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                    <h3 className="font-medium mb-4 flex items-center gap-2"><Users size={18} /> 团队成员</h3>
                    <div className="space-y-3 mb-6">
                      {teamMembers.map(member => {
                        // 计算当前用户在该团队中的角色
                        const currentUserMember = teamMembers.find(m => m.userId === user.id);
                        const canManageMembers = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';
                        return (
                          <div key={member.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl">
                            <div className="flex items-center gap-3">
                              <img src={member.user.avatar} alt={member.user.name} className="w-8 h-8 rounded-full bg-white" />
                              <div>
                                <p className="text-sm font-medium">{member.user.name}</p>
                                <p className="text-xs text-white/50">{member.user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs px-2 py-1 bg-white/10 rounded-md text-white/70 capitalize">
                                {member.role === 'owner' ? '所有者' : member.role === 'admin' ? '管理员' : '成员'}
                              </span>
                              {canManageMembers && member.userId !== user.id && member.role !== 'owner' && (
                                <button 
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-red-400 hover:text-red-300 p-1"
                                  title="移除成员"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(() => {
                      // 计算当前用户在该团队中的角色
                      const currentUserMember = teamMembers.find(m => m.userId === user.id);
                      const canManageMembers = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';
                      return canManageMembers ? (
                        <form onSubmit={handleAddMember} className="flex gap-2">
                          <input 
                            type="email" 
                            placeholder="输入邮箱邀请新成员 (如: bob@example.com)" 
                            required
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 text-sm"
                          />
                          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 text-sm">
                            <UserPlus size={16} />
                            邀请
                          </button>
                        </form>
                      ) : null;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {teams.length === 0 ? (
                    <div className="text-center py-12 text-white/50">
                      <p>您还没有加入任何团队</p>
                    </div>
                  ) : (
                    teams.map(team => (
                      editingTeamId === team.id ? (
                        <form key={team.id} onSubmit={handleUpdateTeam} className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium">编辑团队</h3>
                            <button type="button" onClick={() => setEditingTeamId(null)} className="text-white/50 hover:text-white"><X size={18} /></button>
                          </div>
                          <input 
                            type="text" 
                            placeholder="团队名称" 
                            required
                            value={editTeamName}
                            onChange={(e) => setEditTeamName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                          />
                          <input 
                            type="text" 
                            placeholder="团队描述" 
                            value={editTeamDesc}
                            onChange={(e) => setEditTeamDesc(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                          />
                          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-medium transition-colors">
                            保存更改
                          </button>
                        </form>
                      ) : (
                        <div 
                          key={team.id} 
                          className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group flex justify-between items-center"
                        >
                          <div className="flex-1 cursor-pointer" onClick={() => setSelectedTeamId(team.id)}>
                            <h3 className="font-medium text-lg group-hover:text-blue-400 transition-colors">{team.name}</h3>
                            <p className="text-sm text-white/60 mt-1">{team.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTeamId(team.id);
                                setEditTeamName(team.name);
                                setEditTeamDesc(team.description || '');
                              }}
                              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              title="编辑团队"
                            >
                              <Edit2 size={18} />
                            </button>
                            {team.ownerId === user.id && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTeam(team.id);
                                }}
                                className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="删除团队"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                            <div className="p-2 text-white/40 group-hover:text-white/80 transition-colors cursor-pointer" onClick={() => setSelectedTeamId(team.id)}>
                              <Users size={20} />
                            </div>
                          </div>
                        </div>
                      )
                    ))
                  )}
                </div>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
      />
    </div>
  );
};

