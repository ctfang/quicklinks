import React, { useEffect, useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { LinkGrid } from '../components/LinkGrid';
import { ClockWidget } from '../components/Widgets';
import { useAppContext } from '../context/AppContext';
import { getPopularLinks, getPersonalLinks, getTeamLinks, NavLink, addLink, updateLink, deleteLink, getTeamProjects, Project, addProject, updateProject, deleteProject, NavGroup, getGroups, addGroup, updateGroup, deleteGroup, getGuestNavigation } from '../services/api';
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

  const fetchLinksAndProjects = async () => {
    if (user) {
      if (currentTeam) {
        // Show team links and projects
        const [teamLinks, teamProjects, teamGroups] = await Promise.all([
          getTeamLinks(currentTeam.id),
          getTeamProjects(currentTeam.id),
          getGroups({ teamId: currentTeam.id })
        ]);
        setLinks(teamLinks);
        setProjects(teamProjects);
        setGroups(teamGroups);
      } else {
        // Show personal links
        const [personalLinks, personalGroups] = await Promise.all([
          getPersonalLinks(user.id),
          getGroups({ userId: user.id })
        ]);
        setLinks(personalLinks.length > 0 ? personalLinks : await getPopularLinks());
        setProjects([]);
        setGroups(personalGroups);
      }
    } else {
      const guest = await getGuestNavigation();
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
  const handleAddLink = (projectId?: string) => {
    setEditingLink(null);
    setAddingToProjectId(projectId);
    setIsLinkModalOpen(true);
  };

  const handleEditLink = (link: NavLink) => {
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
        await deleteLink(id);
        fetchLinksAndProjects();
      }
    });
  };

  const handleSaveLink = async (linkData: Partial<NavLink>) => {
    if (editingLink) {
      await updateLink(editingLink.id, linkData);
    } else {
      const newLink = {
        ...linkData,
        isPublic: false,
        userId: currentTeam ? undefined : user?.id,
        teamId: currentTeam ? currentTeam.id : undefined,
        projectId: addingToProjectId
      } as Omit<NavLink, 'id' | 'clicks'>;
      await addLink(newLink);
    }
    fetchLinksAndProjects();
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
        await deleteProject(id);
        fetchLinksAndProjects();
      }
    });
  };

  const handleSaveProject = async (name: string, description: string) => {
    if (editingProject) {
      await updateProject(editingProject.id, { name, description });
    } else if (currentTeam) {
      await addProject(currentTeam.id, name, description);
    }
    fetchLinksAndProjects();
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
    if (editingGroup) {
      await updateGroup(editingGroup.id, { name, order });
    } else {
      await addGroup({
        name,
        userId: currentTeam ? undefined : user?.id,
        teamId: currentTeam ? currentTeam.id : undefined,
        projectId: addingGroupToProjectId,
        order
      });
    }
    fetchLinksAndProjects();
  };

  const handleDeleteGroup = async (id: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除分组',
      message: '确定要删除这个分组吗？分组内的链接将变为未分组状态。',
      onConfirm: async () => {
        await deleteGroup(id);
        fetchLinksAndProjects();
      }
    });
  };

  // Derived data
  const generalLinks = links.filter(l => !l.projectId);
  const generalGroups = groups.filter(g => !g.projectId);

  const renderGroupedLinks = (targetLinks: NavLink[], targetGroups: NavGroup[], projectId?: string, defaultTitle?: string) => {
    const groupedLinks = new Map<string, NavLink[]>();
    targetGroups.forEach(g => groupedLinks.set(g.id, []));
    groupedLinks.set('ungrouped', []);

    targetLinks.forEach(link => {
      if (link.groupId && groupedLinks.has(link.groupId)) {
        groupedLinks.get(link.groupId)!.push(link);
      } else {
        groupedLinks.get('ungrouped')!.push(link);
      }
    });

    return (
      <div className="space-y-6 w-full">
        {targetGroups.map(group => (
          <div key={group.id} className="relative group/section">
            {isEditMode && (
              <div className="absolute -left-10 top-0 opacity-0 group-hover/section:opacity-100 transition-opacity flex flex-col gap-1">
                <button onClick={() => handleEditGroup(group)} className="p-1.5 text-white/50 hover:text-white bg-white/5 hover:bg-white/20 rounded-lg"><Edit2 size={14} /></button>
                <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 text-red-400/50 hover:text-red-400 bg-white/5 hover:bg-red-400/20 rounded-lg"><Trash2 size={14} /></button>
              </div>
            )}
            <LinkGrid 
              links={groupedLinks.get(group.id)!} 
              title={group.name}
              showActions={isEditMode}
              onAdd={() => {
                setEditingLink(null);
                setAddingToProjectId(projectId);
                // We need a way to set initial group id in LinkModal. For now, we just open modal.
                // The user can select the group in the modal.
                setIsLinkModalOpen(true);
              }}
              onEdit={handleEditLink}
              onDelete={handleDeleteLink}
            />
          </div>
        ))}
        
        {/* Ungrouped Links */}
        {(groupedLinks.get('ungrouped')!.length > 0 || targetGroups.length === 0) && (
          <LinkGrid 
            links={groupedLinks.get('ungrouped')!} 
            title={targetGroups.length > 0 ? undefined : defaultTitle}
            showActions={isEditMode}
            onAdd={() => handleAddLink(projectId)}
            onEdit={handleEditLink}
            onDelete={handleDeleteLink}
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
        
        <div className="w-full max-w-5xl">
          {currentTeam ? (
            <div className="space-y-16 w-full">
              {/* Team General Links */}
              <div>
                <h2 className="text-xl font-medium text-white mb-6">团队公共导航</h2>
                {renderGroupedLinks(generalLinks, generalGroups, undefined, "所有导航")}
              </div>

              {/* Team Projects */}
              <div>
                <div className="flex items-center justify-between mb-6 px-2">
                  <h2 className="text-xl font-medium text-white flex items-center gap-2">
                    <FolderKanban size={20} className="text-purple-400" />
                    项目空间
                  </h2>
                  {isEditMode && (
                    <button 
                      onClick={handleAddProject}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-100 text-sm rounded-full transition-colors backdrop-blur-md border border-purple-500/30"
                    >
                      <Plus size={16} />
                      新建项目
                    </button>
                  )}
                </div>
                
                {projects.length > 0 ? (
                  <div className="grid grid-cols-1 gap-8">
                    {projects.map(project => {
                      const projectLinks = links.filter(l => l.projectId === project.id);
                      const projectGroups = groups.filter(g => g.projectId === project.id);
                      return (
                        <div key={project.id} className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col">
                          <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                              {project.description && (
                                <p className="text-sm text-white/60 mt-1">{project.description}</p>
                              )}
                            </div>
                            {isEditMode && (
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => handleEditProject(project)}
                                  className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                  title="编辑项目"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                  title="删除项目"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1">
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
        onClose={() => setIsLinkModalOpen(false)}
        onSave={handleSaveLink}
        initialData={editingLink || undefined}
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
