import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getUserWidgets, updateWidgetConfig, WidgetConfig, getTeamMembers, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, TeamMember } from '../services/api';
import { Save, User as UserIcon, LayoutDashboard, Users, Plus, X, UserPlus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmModal } from '../components/ConfirmModal';

export const Settings = () => {
  const { user, teams, loginUser, isEditMode, setIsEditMode, isSettingsOpen, setIsSettingsOpen, isAdmin } = useAppContext();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'widgets' | 'teams'>('profile');

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

