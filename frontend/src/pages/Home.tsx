import React, { useEffect, useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { LinkGrid } from '../components/LinkGrid';
import { ClockWidget } from '../components/Widgets';
import { useAppContext } from '../context/AppContext';
import {
  getPopularLinks,
  NavLink,
  Project,
  NavGroup,
  // 带缓存的 API
  getGuestNavigation,
  getPersonalLinksWithCache,
  getTeamLinksWithCache,
  getGroupsWithCache,
  getTeamProjectsWithCache,
  // 带缓存的数据变更操作
  addLinkWithCache,
  updateLinkWithCache,
  deleteLinkWithCache,
  addProjectWithCache,
  updateProjectWithCache,
  deleteProjectWithCache,
  addGroupWithCache,
  updateGroupWithCache,
  deleteGroupWithCache,
  updateLinksOrderWithCache,
} from '../services/api';
import { LinkModal } from '../components/LinkModal';
import { ProjectModal } from '../components/ProjectModal';
import { GroupModal } from '../components/GroupModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Plus, FolderKanban, Edit2, Trash2, Link as LinkIcon, Settings2, X, FolderPlus } from 'lucide-react';

export const Home = () => {
  const { user, currentTeam, isEditMode, setIsEditMode, setGuestNavUserId } = useAppContext();
  const [links, setLinks] = useState<NavLink[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<NavGroup[]>([]);
  
  // Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<NavLink | null>(null);
  const [addingToProjectId, setAddingToProjectId] = useState<string | undefined>(undefined);
  const [addingToGroupId, setAddingToGroupId] = useState<string | undefined>(undefined);

  // Project Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  // Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NavGroup | null>(null);
  const [addingGroupToProjectId, setAddingGroupToProjectId] = useState<string | undefined>(undefined);

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

  // 获取数据：缓存优先，无缓存才请求服务器
  const fetchLinksAndProjects = async (options?: { forceRefresh?: boolean }) => {
    const useCache = !options?.forceRefresh;
    
    if (user) {
      if (currentTeam) {
        // 团队空间
        const context = { teamId: currentTeam.id };
        
        if (useCache) {
          // 尝试从缓存读取
          const cachedLinks = await getTeamLinksWithCache(currentTeam.id, { useCache: true });
          const cachedProjects = await getTeamProjectsWithCache(currentTeam.id, { useCache: true });
          const cachedGroups = await getGroupsWithCache(context, { useCache: true });
          
          // 如果缓存存在，直接使用缓存，不请求服务器
          if (cachedLinks && cachedProjects && cachedGroups) {
            setLinks(cachedLinks);
            setProjects(cachedProjects);
            setGroups(cachedGroups);
            return; // 有缓存，直接返回
          }
        }
        
        // 无缓存或强制刷新，请求服务器
        const [teamLinks, teamProjects, teamGroups] = await Promise.all([
          getTeamLinksWithCache(currentTeam.id, { useCache: false }),
          getTeamProjectsWithCache(currentTeam.id, { useCache: false }),
          getGroupsWithCache(context, { useCache: false })
        ]);
        setLinks(teamLinks);
        setProjects(teamProjects);
        setGroups(teamGroups);
      } else {
        // 个人空间
        const context = { userId: user.id };
        
        if (useCache) {
          // 尝试从缓存读取
          const cachedLinks = await getPersonalLinksWithCache(user.id, { useCache: true });
          const cachedGroups = await getGroupsWithCache(context, { useCache: true });
          
          // 如果缓存存在，直接使用缓存
          if (cachedLinks && cachedGroups) {
            setLinks(cachedLinks.length > 0 ? cachedLinks : await getPopularLinks());
            setProjects([]);
            setGroups(cachedGroups);
            return; // 有缓存，直接返回
          }
        }
        
        // 无缓存或强制刷新，请求服务器
        const [personalLinks, personalGroups] = await Promise.all([
          getPersonalLinksWithCache(user.id, { useCache: false }),
          getGroupsWithCache(context, { useCache: false })
        ]);
        setLinks(personalLinks.length > 0 ? personalLinks : await getPopularLinks());
        setProjects([]);
        setGroups(personalGroups);
      }
    } else {
      // 访客模式
      if (useCache) {
        // 尝试从缓存读取
        const cachedGuest = await getGuestNavigation({ useCache: true });
        if (cachedGuest) {
          setGuestNavUserId(cachedGuest.userId);
          setLinks(cachedGuest.links);
          setGroups(cachedGuest.groups);
          setProjects([]);
          return; // 有缓存，直接返回
        }
      }
      
      // 无缓存或强制刷新，请求服务器
      const guest = await getGuestNavigation({ useCache: false });
      setGuestNavUserId(guest.userId);
      setLinks(guest.links);
      setGroups(guest.groups);
      setProjects([]);
    }
  };

  useEffect(() => {
    fetchLinksAndProjects();
  }, [user, currentTeam]);

  // --- Link Handlers ---
  const handleAddLink = (projectId?: string, groupId?: string) => {
    setEditingLink(null);
    setAddingToProjectId(projectId);
    setAddingToGroupId(groupId);
    setIsLinkModalOpen(true);
  };

  const handleEditLink = (link: NavLink) => {
    setEditingLink(link);
    setAddingToProjectId(link.projectId);
    setAddingToGroupId(undefined);
    setIsLinkModalOpen(true);
  };

  const handleDeleteLink = async (id: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除导航链接',
      message: '确定要删除这个导航链接吗？',
      onConfirm: async () => {
        const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};
        await deleteLinkWithCache(id, context);
        // 缓存已更新，同时更新本地状态以移除被删除的链接
        setLinks(prevLinks => prevLinks.filter(link => link.id !== id));
      }
    });
  };

  const handleSaveLink = async (linkData: Partial<NavLink>) => {
    const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};
    
    if (editingLink) {
      const updatedLink = await updateLinkWithCache(editingLink.id, linkData, context);
      // 更新本地状态以反映修改
      setLinks(prevLinks => 
        prevLinks.map(link => {
          if (link.id === updatedLink.id) {
            // 显式处理 bgColor，确保能正确清除背景色（处理 null 值）
            const merged = { ...link, ...updatedLink };
            if (updatedLink.bgColor === null) {
              delete merged.bgColor;
            }
            return merged;
          }
          return link;
        })
      );
    } else {
      const newLink = {
        ...linkData,
        isPublic: false,
        userId: currentTeam ? undefined : user?.id,
        teamId: currentTeam ? currentTeam.id : undefined,
        projectId: addingToProjectId
      } as Omit<NavLink, 'id' | 'clicks'>;
      const createdLink = await addLinkWithCache(newLink, context);
      // 添加新链接到本地状态
      setLinks(prevLinks => [...prevLinks, createdLink]);
    }
  };

  // --- Project Handlers ---
  const handleAddProject = () => {
    setEditingProject(undefined);
    setIsProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectModalOpen(true);
  };

  const handleDeleteProject = async (id: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除项目',
      message: '确定要删除这个项目及其所有链接吗？此操作不可恢复。',
      onConfirm: async () => {
        if (currentTeam) {
          await deleteProjectWithCache(id, currentTeam.id);
          // 更新本地状态以移除被删除的项目
          setProjects(prevProjects => prevProjects.filter(p => p.id !== id));
        }
      }
    });
  };

  const handleSaveProject = async (name: string, description: string) => {
    if (editingProject && currentTeam) {
      const updatedProject = await updateProjectWithCache(editingProject.id, { name, description }, currentTeam.id);
      // 更新本地状态以反映修改
      setProjects(prevProjects =>
        prevProjects.map(p => p.id === editingProject.id ? updatedProject : p)
      );
    } else if (currentTeam) {
      const createdProject = await addProjectWithCache(currentTeam.id, name, description);
      // 添加新项目到本地状态
      setProjects(prevProjects => [...prevProjects, createdProject]);
    }
  };

  // --- Group Handlers ---
  const handleAddGroup = (projectId?: string) => {
    setEditingGroup(null);
    setAddingGroupToProjectId(projectId);
    setIsGroupModalOpen(true);
  };

  const handleEditGroup = (group: NavGroup) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (name: string, order: number) => {
    const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};

    if (editingGroup) {
      const updatedGroup = await updateGroupWithCache(editingGroup.id, { name, order }, context);
      // 更新本地状态以反映修改，并按 order 排序
      setGroups(prevGroups => {
        const updated = prevGroups.map(g => g.id === editingGroup.id ? updatedGroup : g);
        return updated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      });
    } else {
      const createdGroup = await addGroupWithCache({
        name,
        userId: currentTeam ? undefined : user?.id,
        teamId: currentTeam ? currentTeam.id : undefined,
        projectId: addingGroupToProjectId,
        order
      }, context);
      // 添加新分组到本地状态，并按 order 排序
      setGroups(prevGroups => [...prevGroups, createdGroup].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除分组',
      message: '确定要删除这个分组吗？分组内的链接将变为未分组状态。',
      onConfirm: async () => {
        const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};
        await deleteGroupWithCache(id, context);
        // 更新本地状态以移除被删除的分组
        setGroups(prevGroups => prevGroups.filter(g => g.id !== id));
      }
    });
  };

  // 处理链接重新排序
  const handleReorderLinks = async (groupId: string | undefined, reorderedLinks: NavLink[]) => {
    const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};
    
    // 构建更新数据：包含 order 和 rowNum
    const updates = reorderedLinks.map(link => ({
      id: link.id,
      order: link.order ?? 0,
      rowNum: link.rowNum ?? 0,
    }));

    // 乐观更新本地状态
    setLinks(prev => prev.map(l => {
      const update = updates.find(u => u.id === l.id);
      return update ? { ...l, order: update.order, rowNum: update.rowNum } : l;
    }));

    try {
      await updateLinksOrderWithCache(updates, context);
    } catch (err) {
      console.error('Failed to reorder links:', err);
      fetchLinksAndProjects({ forceRefresh: true });
    }
  };

  // Derived data
  const generalLinks = links.filter(l => !l.projectId);
  const generalGroups = groups.filter(g => !g.projectId);

  const renderGroupedLinks = (targetLinks: NavLink[], targetGroups: NavGroup[], projectId?: string, defaultTitle?: string) => {
    // 按 order 排序分组
    const sortedGroups = [...targetGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const groupedLinks = new Map<string, NavLink[]>();
    sortedGroups.forEach(g => groupedLinks.set(g.id, []));
    groupedLinks.set('ungrouped', []);

    // 按 order 排序后再分组
    const sortedLinks = [...targetLinks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sortedLinks.forEach(link => {
      if (link.groupId && groupedLinks.has(link.groupId)) {
        groupedLinks.get(link.groupId)!.push(link);
      } else {
        groupedLinks.get('ungrouped')!.push(link);
      }
    });

    return (
      <div className="space-y-6 w-full">
        {sortedGroups.map(group => (
          <div key={group.id} className="relative group/section">
            <LinkGrid 
              links={groupedLinks.get(group.id)!} 
              title={group.name}
              showActions={isEditMode}
              groupId={group.id}
              groupActions={isEditMode ? (
                <div className="flex gap-1 ml-2 shrink-0">
                  <button onClick={() => handleEditGroup(group)} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-400/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </div>
              ) : undefined}
              onAdd={() => handleAddLink(projectId, group.id)}
              onEdit={handleEditLink}
              onDelete={handleDeleteLink}
              onReorder={isEditMode ? handleReorderLinks : undefined}
            />
          </div>
        ))}
        
        {/* Ungrouped Links */}
        {(groupedLinks.get('ungrouped')!.length > 0 || targetGroups.length === 0) && (
          <LinkGrid 
            links={groupedLinks.get('ungrouped')!} 
            title={targetGroups.length > 0 ? undefined : defaultTitle}
            showActions={isEditMode}
            groupId={undefined}
            onAdd={() => handleAddLink(projectId)}
            onEdit={handleEditLink}
            onDelete={handleDeleteLink}
            onReorder={isEditMode ? handleReorderLinks : undefined}
          />
        )}

        {isEditMode && (
          <div className="flex justify-center mt-4">
            <button 
              onClick={() => handleAddGroup(projectId)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white/50 hover:text-white border border-dashed border-white/20 hover:border-white/50 rounded-xl transition-colors"
            >
              <FolderPlus size={16} />
              添加分组
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 w-full max-w-6xl mx-auto h-full pb-32 pt-10 overflow-y-auto custom-scrollbar relative">
      <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        <ClockWidget />
        
        <div className="w-full max-w-3xl mb-12">
          <SearchBar />
        </div>
        
        <div className="w-full max-w-6xl">
          {currentTeam ? (
            <div className="space-y-12 w-full">
              {/* Team Projects - 优先显示 */}
              <div>
                {isEditMode && (
                  <div className="flex justify-end mb-4 px-2">
                    <button 
                      onClick={handleAddProject}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-100 text-sm rounded-full transition-colors backdrop-blur-md border border-purple-500/30"
                    >
                      <Plus size={16} />
                      新建项目
                    </button>
                  </div>
                )}
                
                {projects.length > 0 ? (
                  <div className="space-y-8">
                    {projects.map(project => {
                      const projectLinks = links.filter(l => l.projectId === project.id);
                      const projectGroups = groups.filter(g => g.projectId === project.id);
                      return (
                        <div key={project.id} className="w-full">
                          <div className="flex justify-between items-start mb-4 px-1">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FolderKanban size={18} className="text-purple-400" />
                                {project.name}
                              </h3>
                              {project.description && (
                                <p className="text-sm text-white/60 mt-1">{project.description}</p>
                              )}
                            </div>
                            {isEditMode && (
                              <div className="flex gap-1 ml-2 shrink-0">
                                <button 
                                  onClick={() => handleEditProject(project)}
                                  className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                  title="编辑项目"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                  title="删除项目"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="w-full">
                            {renderGroupedLinks(projectLinks, projectGroups, project.id, "项目导航")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-white/50 bg-white/5 rounded-3xl border border-white/10 border-dashed">
                    <FolderKanban size={48} className="mx-auto mb-4 opacity-20" />
                    <p>暂无项目，请在设置中开启"管理导航"后新建项目</p>
                  </div>
                )}
              </div>

              {/* Team General Links */}
              <div>
                <h2 className="text-xl font-medium text-white mb-6">团队公共导航</h2>
                {renderGroupedLinks(generalLinks, generalGroups, undefined, "所有导航")}
              </div>
            </div>
          ) : (
            /* Personal Space */
            <div className="w-full">
              {renderGroupedLinks(links, groups, undefined, "所有导航")}
            </div>
          )}
        </div>
      </div>

      <LinkModal 
        isOpen={isLinkModalOpen}
        onClose={() => {
          setIsLinkModalOpen(false);
          setAddingToGroupId(undefined);
        }}
        onSave={handleSaveLink}
        initialData={editingLink || (addingToGroupId ? { groupId: addingToGroupId } : undefined)}
        groups={groups.filter(g => g.projectId === addingToProjectId)}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        initialData={editingProject}
      />

      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSave={handleSaveGroup}
        initialData={editingGroup}
      />

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
