import { Input, Button, Switch, Alert } from 'antd';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getUserWidgets, updateWidgetConfig, WidgetConfig, getTeamMembers, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, TeamMember, changePassword } from '../services/api';
import { clearAllNavCache } from '../lib/dataCache';
import { Save, User as UserIcon, LayoutDashboard, Users, Plus, X, UserPlus, Trash2, Edit2, Lock, Search, Cloud, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { md5Hex } from '../lib/passwordHash';
import { cn } from '../lib/utils';
import { ConfirmModal } from '../components/ConfirmModal';
import { SEARCH_ENGINES, SearchEngine } from '../lib/searchEngine';

export type SettingsTab = 'profile' | 'widgets' | 'teams' | 'search' | 'weather' | 'security' | 'sync';

export const Settings = ({ section = 'profile' }: { section?: SettingsTab }) => {
  const {
    user,
    teams,
    loginUser,
    isAdmin,
    weatherLocation,
    setWeatherLocation,
    searchEngine,
    setSearchEngine,
  } = useAppContext();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const activeTab = section;

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
    if (user) {
      getUserWidgets(user.id).then(setWidgets);
    }
  }, [user]);

  useEffect(() => {
    {
      setWeatherProvinceDraft(weatherLocation.province);
      setWeatherCityDraft(weatherLocation.city);
    }
  }, [weatherLocation.province, weatherLocation.city]);

  useEffect(() => {
    if (selectedTeamId) {
      getTeamMembers(selectedTeamId).then(setTeamMembers);
    }
  }, [selectedTeamId]);

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


  if (!user) return <p className="p-8 text-center">请登录后访问设置。</p>;

  return (
    <div className="w-full flex items-center justify-center">


      <div className="settings-panel relative w-full bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
        <div className="p-6 md:p-8">
          <div>
            {/* Content */}
            <div className="min-w-0 min-h-[420px]">
          {activeTab === 'profile' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-medium border-b border-slate-200 pb-4 mb-6">个人资料</h2>
                <div className="flex items-center gap-6">
                  <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full border-4 border-slate-200 bg-white" />
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2 flex-wrap">
                      {user.name}
                      {isAdmin && (
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 border border-amber-400/30">
                          管理员
                        </span>
                      )}
                    </h3>
                    <p className="text-slate-500">{user.email}</p>
                    {isAdmin && (
                      <p className="text-sm text-slate-500 mt-2 max-w-md">
                        您是当前用于访客首页展示的那位用户（按用户 id 排序的第一条账号）。未登录访客看到的首页即您「个人空间」下的链接与分组；请在管理页面的「导航管理」中编辑。
                      </p>
                    )}
                  </div>
                </div>
              </div>


            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-xl font-medium">搜索引擎</h2>
              </div>
              <p className="text-sm text-slate-500">
                选择默认的搜索引擎，将用于首页搜索栏的网页搜索功能。
              </p>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 max-w-md">
                {SEARCH_ENGINES.map((engine) => (
                  <label
                    key={engine.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                      searchEngine.id === engine.id
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "bg-slate-50 border border-slate-200 hover:bg-slate-50"
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
                    <span className="flex-1 text-slate-900">{engine.name}</span>
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
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-xl font-medium">天气城市</h2>
              </div>
              <p className="text-sm text-slate-500">
                默认广东 / 深圳；可改为其他城市，将保存在本浏览器并用于顶部天气与背景。
              </p>
              <form
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 max-w-md"
                onSubmit={(e) => {
                  e.preventDefault();
                  setWeatherLocation({
                    province: weatherProvinceDraft,
                    city: weatherCityDraft,
                  });
                }}
              >
                <div>
                  <label htmlFor="settings-weather-province" className="block text-sm text-slate-700 mb-1">
                    省份
                  </label>
                  <Input
                    id="settings-weather-province"
                    type="text"
                    value={weatherProvinceDraft}
                    onChange={(e) => setWeatherProvinceDraft(e.target.value)}
                    className="w-full"
                    placeholder="广东"
                  />
                </div>
                <div>
                  <label htmlFor="settings-weather-city" className="block text-sm text-slate-700 mb-1">
                    城市
                  </label>
                  <Input
                    id="settings-weather-city"
                    type="text"
                    value={weatherCityDraft}
                    onChange={(e) => setWeatherCityDraft(e.target.value)}
                    className="w-full"
                    placeholder="深圳"
                  />
                </div>
                <Button type="primary"
                  htmlType="submit"

                >
                  保存天气城市
                </Button>
              </form>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-xl font-medium">数据同步</h2>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700/80">
                  <p className="font-medium text-amber-700 mb-1">多设备同步提示</p>
                  <p>如果您在多台电脑登录同一账号，本地缓存可能导致数据不同步。当其他设备添加了新的导航链接或分组时，您需要点击下方的「刷新缓存」按钮才能看到最新数据。</p>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <RefreshCw size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">刷新本地缓存</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      清除本地缓存并从服务器重新获取最新数据。适用于：
                    </p>
                    <ul className="text-sm text-slate-500 mt-2 space-y-1 list-disc list-inside">
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

                <Button type="primary"
                  onClick={handleRefreshCache}
                  disabled={isRefreshingCache}
                  className="w-full gap-2"
                >
                  <RefreshCw size={18} className={isRefreshingCache ? 'animate-spin' : ''} />
                  {isRefreshingCache ? '刷新中...' : '刷新缓存'}
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="font-medium text-slate-900 mb-3">缓存工作原理</h3>
                <div className="space-y-2 text-sm text-slate-500">
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
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-xl font-medium">安全设置</h2>
              </div>
              <div>
                {!isChangingPassword ? (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Lock size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">修改密码</h3>
                        <p className="text-sm text-slate-500 mt-1">定期更换密码可以提高账号安全性</p>
                      </div>
                    </div>
                    <Button type="default"
                      onClick={() => setIsChangingPassword(true)}

                    >
                      修改
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4 max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Lock size={20} className="text-blue-600" />
                      </div>
                      <h3 className="font-medium">修改密码</h3>
                    </div>

                    {passwordError && (
                      <Alert type="error" title={passwordError} showIcon />
                    )}
                    {passwordSuccess && (
                      <Alert type="success" title={passwordSuccess} showIcon />
                    )}

                    <div className="relative">
                      <Input.Password visibilityToggle={{ visible: showOldPassword, onVisibleChange: setShowOldPassword }}
                        placeholder="当前密码"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full"
                        required
                      />

                    </div>

                    <div className="relative">
                      <Input.Password visibilityToggle={{ visible: showNewPassword, onVisibleChange: setShowNewPassword }}
                        placeholder="新密码（至少 6 位）"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full"
                        required
                        minLength={6}
                      />

                    </div>

                    <div className="relative">
                      <Input.Password visibilityToggle={{ visible: showNewPassword, onVisibleChange: setShowNewPassword }}
                        placeholder="确认新密码"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button type="default"
                        htmlType="button"
                        onClick={cancelChangePassword}
                        className="flex-1"
                      >
                        取消
                      </Button>
                      <Button type="primary"
                        htmlType="submit"
                        className="flex-1"
                      >
                        确认修改
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {activeTab === 'widgets' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-xl font-medium">小组件设置</h2>
                <Button type="primary"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Save size={16} />
                  {isSaving ? '保存中...' : '保存更改'}
                </Button>
              </div>
              <div className="space-y-4">
                {widgets.map(widget => (
                  <div key={widget.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <h3 className="font-medium capitalize">{widget.type === 'weather' ? '天气' : widget.type === 'clock' ? '时钟' : widget.type === 'todo' ? '待办事项' : '每日格言'}</h3>
                      <p className="text-sm text-slate-500 mt-1">在首页显示此小组件</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <Switch aria-label={`显示${widget.type}组件`} checked={widget.visible} onChange={() => handleToggleWidget(widget.id)} />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-xl font-medium">
                  {selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '我的团队'}
                </h2>
                {!selectedTeamId ? (
                  <Button type="primary"
                    onClick={() => setIsCreatingTeam(true)}
                    className="gap-2"
                  >
                    <Plus size={16} />
                    创建团队
                  </Button>
                ) : (
                  <Button type="default"
                    onClick={() => setSelectedTeamId(null)}
                    className="gap-2"
                  >
                    返回列表
                  </Button>
                )}
              </div>

              {isCreatingTeam ? (
                <form onSubmit={handleCreateTeam} className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">创建新团队</h3>
                    <Button type="default" htmlType="button" onClick={() => setIsCreatingTeam(false)} ><X size={18} /></Button>
                  </div>
                  <Input
                    type="text"
                    placeholder="团队名称"
                    required
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full"
                  />
                  <Input
                    type="text"
                    placeholder="团队描述"
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                    className="w-full"
                  />
                  <Button type="primary" htmlType="submit" className="w-full">
                    确认创建
                  </Button>
                </form>
              ) : selectedTeamId ? (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <h3 className="font-medium mb-4 flex items-center gap-2"><Users size={18} /> 团队成员</h3>
                    <div className="space-y-3 mb-6">
                      {teamMembers.map(member => {
                        // 计算当前用户在该团队中的角色
                        const currentUserMember = teamMembers.find(m => m.userId === user.id);
                        const canManageMembers = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';
                        return (
                          <div key={member.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                            <div className="flex items-center gap-3">
                              <img src={member.user.avatar} alt={member.user.name} className="w-8 h-8 rounded-full bg-white" />
                              <div>
                                <p className="text-sm font-medium">{member.user.name}</p>
                                <p className="text-xs text-slate-500">{member.user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs px-2 py-1 bg-slate-50 rounded-md text-slate-700 capitalize">
                                {member.role === 'owner' ? '所有者' : member.role === 'admin' ? '管理员' : '成员'}
                              </span>
                              {canManageMembers && member.userId !== user.id && member.role !== 'owner' && (
                                <Button type="text" danger
                                  onClick={() => handleRemoveMember(member.id)}

                                  title="移除成员"
                                >
                                  <Trash2 size={16} />
                                </Button>
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
                          <Input
                            type="email"
                            placeholder="输入邮箱邀请新成员 (如: bob@example.com)"
                            required
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            className="flex-1"
                          />
                          <Button type="primary" htmlType="submit" className="gap-2">
                            <UserPlus size={16} />
                            邀请
                          </Button>
                        </form>
                      ) : null;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {teams.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>您还没有加入任何团队</p>
                    </div>
                  ) : (
                    teams.map(team => (
                      editingTeamId === team.id ? (
                        <form key={team.id} onSubmit={handleUpdateTeam} className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium">编辑团队</h3>
                            <Button type="default" htmlType="button" onClick={() => setEditingTeamId(null)} ><X size={18} /></Button>
                          </div>
                          <Input
                            type="text"
                            placeholder="团队名称"
                            required
                            value={editTeamName}
                            onChange={(e) => setEditTeamName(e.target.value)}
                            className="w-full"
                          />
                          <Input
                            type="text"
                            placeholder="团队描述"
                            value={editTeamDesc}
                            onChange={(e) => setEditTeamDesc(e.target.value)}
                            className="w-full"
                          />
                          <Button type="primary" htmlType="submit" className="w-full">
                            保存更改
                          </Button>
                        </form>
                      ) : (
                        <div
                          key={team.id}
                          className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-50 transition-colors group flex justify-between items-center"
                        >
                          <div className="flex-1 cursor-pointer" onClick={() => setSelectedTeamId(team.id)}>
                            <h3 className="font-medium text-lg group-hover:text-blue-600 transition-colors">{team.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">{team.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTeamId(team.id);
                                setEditTeamName(team.name);
                                setEditTeamDesc(team.description || '');
                              }}

                              title="编辑团队"
                            >
                              <Edit2 size={18} />
                            </Button>
                            {team.ownerId === user.id && (
                              <Button type="text" danger
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTeam(team.id);
                                }}

                                title="删除团队"
                              >
                                <Trash2 size={18} />
                              </Button>
                            )}
                            <div className="p-2 text-slate-500 group-hover:text-slate-700 transition-colors cursor-pointer" onClick={() => setSelectedTeamId(team.id)}>
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

