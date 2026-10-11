import React, { useEffect, useState } from 'react';
import { LinkGrid } from './LinkGrid';
import { useAppContext } from '../context/AppContext';
import {
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
import { LinkModal } from './LinkModal';
import { ProjectModal } from './ProjectModal';
import { GroupModal } from './GroupModal';
import { ConfirmModal } from './ConfirmModal';
import { NavigationAppearanceSettings, NavigationAppearanceQuickSwitch, FloatingNavigation } from './NavigationAppearance';
import { useNavigationAppearance } from '../lib/navigationAppearance';
import { useFloatingNavigation } from '../lib/floatingNavigation';
import { useRecentNavigation } from '../lib/recentNavigation';
import { NavigationLibrary } from './NavigationLibrary';
import { Plus, FolderKanban, Edit2, Trash2, FolderPlus } from 'lucide-react';

export const NavigationContent = ({ management = false }: { management?: boolean }) => {
  const { user, currentTeam, guestNavUserId, setGuestNavUserId } = useAppContext();
  const isEditMode = management && Boolean(user);
  const scope = currentTeam ? `team_${currentTeam.id}` : user ? `user_${user.id}` : 'guest';
  const [appearance, setAppearance] = useNavigationAppearance(scope);
  const [floatingNavigation] = useFloatingNavigation(user ? scope : null);
  const [recentNavigation, recordNavigation] = useRecentNavigation(user ? scope : 'guest');
  const recordClick = (event: React.MouseEvent) => {
    if (management || (event.type === 'auxclick' && event.button !== 1)) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[data-nav-title]');
    if (!anchor) return;
    recordNavigation({ id: anchor.href, url: anchor.href, title: anchor.dataset.navTitle || anchor.title, icon: anchor.dataset.navIcon || 'Link' });
  };
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<NavLink[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<NavGroup[]>([]);
  
  // Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<NavLink | null>(null);
  const [addingToGroupId, setAddingToGroupId] = useState<string | undefined>(undefined);
  const [addingToProjectId, setAddingToProjectId] = useState<string | undefined>(undefined);

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
            setLinks(cachedLinks);
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
        setLinks(personalLinks);
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
    setLinks([]);
    setProjects([]);
    setGroups([]);
    setError('');
    setLoading(true);
    fetchLinksAndProjects().catch(() => setError('导航加载失败，请刷新重试。')).finally(() => setLoading(false));
  }, [user, currentTeam, management]);

  // --- Link Handlers ---
  const handleAddLink = (projectId?: string) => {
    setEditingLink(null);
    setAddingToGroupId(undefined);
    setAddingToProjectId(projectId);
    setIsLinkModalOpen(true);
  };

  const handleEditLink = (link: NavLink) => {
    setAddingToGroupId(undefined);
    setEditingLink(link);
    setAddingToProjectId(link.projectId);
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
        }
        await fetchLinksAndProjects({ forceRefresh: true });
      }
    });
  };

  const handleSaveProject = async (name: string, description: string) => {
    if (editingProject && currentTeam) {
      await updateProjectWithCache(editingProject.id, { name, description }, currentTeam.id);
    } else if (currentTeam) {
      await addProjectWithCache(currentTeam.id, name, description);
    }
    await fetchLinksAndProjects();
  };

  // --- Group Handlers ---
  const handleAddGroup = (projectId?: string) => {
    setEditingGroup(null);
    setAddingGroupToProjectId(projectId);
    setIsGroupModalOpen(true);
  };

  const handleEditGroup = (group: NavGroup) => {
    setEditingGroup(group);
    setAddingGroupToProjectId(group.projectId);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (name: string, order: number) => {
    const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};
    
    if (editingGroup) {
      await updateGroupWithCache(editingGroup.id, { name, order }, context);
    } else {
      await addGroupWithCache({
        name,
        userId: currentTeam ? undefined : user?.id,
        teamId: currentTeam ? currentTeam.id : undefined,
        projectId: addingGroupToProjectId,
        order
      }, context);
    }
    await fetchLinksAndProjects();
  };

  const handleDeleteGroup = async (id: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除分组',
      message: '确定要删除这个分组吗？分组内的链接将变为未分组状态。',
      onConfirm: async () => {
        const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};
        await deleteGroupWithCache(id, context);
        await fetchLinksAndProjects();
      }
    });
  };

  // 处理链接重新排序
  const handleReorderLinks = async (groupId: string | undefined, reorderedLinks: NavLink[]) => {
    // 构建更新数据，只更新 order 字段
    const updates = reorderedLinks.map((link, index) => ({
      id: link.id,
      order: index,
    }));
    
    try {
      const context = currentTeam ? { teamId: currentTeam.id } : user ? { userId: user.id } : {};
      await updateLinksOrderWithCache(updates, context);
      // 缓存已更新，同时更新本地状态以反映新的顺序
      setLinks(prevLinks => {
        const newLinks = [...prevLinks];
        // 更新被重新排序的链接的 order 值
        reorderedLinks.forEach((link, index) => {
          const existingIndex = newLinks.findIndex(l => l.id === link.id);
          if (existingIndex !== -1) {
            newLinks[existingIndex] = { ...newLinks[existingIndex], order: index };
          }
        });
        return newLinks;
      });
    } catch (err) {
      console.error('Failed to reorder links:', err);
      // 如果保存失败，重新获取数据
      fetchLinksAndProjects({ forceRefresh: true });
    }
  };

  // Derived data
  const generalLinks = links.filter(l => !l.projectId);
  const generalGroups = groups.filter(g => !g.projectId);

  const renderGroupedLinks = (targetLinks: NavLink[], targetGroups: NavGroup[], projectId?: string, defaultTitle?: string) => {
    const groupedLinks = new Map<string, NavLink[]>();
    targetGroups.forEach(g => groupedLinks.set(g.id, []));
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
        {[...targetGroups].sort((a, b) => a.order - b.order).map(group => (
          <div key={group.id} className="relative group/section">
            {isEditMode && (
              <div className="absolute -left-10 top-0 opacity-0 group-hover/section:opacity-100 transition-opacity flex flex-col gap-1">
                <button onClick={() => handleEditGroup(group)} aria-label="编辑分组" className="p-1.5 text-white/50 hover:text-white bg-white/5 hover:bg-white/20 rounded-lg"><Edit2 size={14} /></button>
                <button onClick={() => handleDeleteGroup(group.id)} aria-label="删除分组" className="p-1.5 text-red-400/50 hover:text-red-400 bg-white/5 hover:bg-red-400/20 rounded-lg"><Trash2 size={14} /></button>
              </div>
            )}
            <LinkGrid 
              links={groupedLinks.get(group.id)!} 
              title={group.name}
              showActions={isEditMode}
              cardMode={appearance.cardMode}
              layoutMode={appearance.layoutMode}
              groupId={group.id}
              onAdd={() => {
                setEditingLink(null);
                setAddingToProjectId(projectId);
                setAddingToGroupId(group.id);
                setIsLinkModalOpen(true);
              }}
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
            title={targetGroups.length > 0 ? '未分组导航' : defaultTitle}
            showActions={isEditMode}
            cardMode={appearance.cardMode}
            layoutMode={appearance.layoutMode}
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
    <div onClickCapture={recordClick} onAuxClickCapture={recordClick} className={`${management ? 'navigation-management' : `navigation-page theme-${appearance.theme} style-${appearance.style} background-${appearance.background} layout-${appearance.layoutMode} px-5 md:px-24 pb-28 pt-8`} flex-1 flex flex-col items-center w-full mx-auto relative`}>
      {!management && <FloatingNavigation value={floatingNavigation} recent={recentNavigation} />}
      {!management && <div className="navigation-appearance-dock"><NavigationAppearanceQuickSwitch value={appearance} onChange={setAppearance} /></div>}
      {management && <div className="w-full max-w-6xl mb-8"><NavigationAppearanceSettings value={appearance} onChange={setAppearance} /></div>}
      {!management ? <NavigationLibrary links={links} groups={groups} projects={projects} appearance={appearance} loading={loading} error={error} /> : <div className="w-full flex flex-col items-center">
        {error && <p role="alert" className="mb-4 text-red-300">{error}</p>}
        {loading && <p role="status" className="mb-4 text-white/60">正在加载导航…</p>}
        
        <div className="w-full max-w-6xl navigation-sections">
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
                    <p>暂无项目，可在管理页面新建项目</p>
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
      </div>}

      <LinkModal 
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSave={handleSaveLink}
        initialData={editingLink || undefined}
        initialGroupId={addingToGroupId}
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
