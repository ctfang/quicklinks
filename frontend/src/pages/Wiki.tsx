import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getTeamWikiNodes, createWikiNode, updateWikiNode, deleteWikiNode, WikiNode } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { Save, Book, Folder, FileText, ChevronRight, ChevronDown, Trash2, FolderPlus, FilePlus, Eye, Code, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { ConfirmModal } from '../components/ConfirmModal';

export const Wiki = () => {
  const { id } = useParams<{ id: string }>();
  const { teams } = useAppContext();
  const [nodes, setNodes] = useState<WikiNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // VS Code style inline creation state
  const [creating, setCreating] = useState<{ parentId: string | null, type: 'folder' | 'document' } | null>(null);
  const [createName, setCreateName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  const team = teams.find(t => t.id === id);
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      getTeamWikiNodes(id).then(data => {
        const nodesList = data ?? [];
        setNodes(nodesList);
        const roots = nodesList.filter(n => n.parentId === null && n.type === 'folder');
        setExpandedFolders(new Set(roots.map(r => r.id)));
        
        const firstDoc = nodesList.find(n => n.type === 'document');
        if (firstDoc) {
          setSelectedNodeId(firstDoc.id);
        }
        setIsLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (selectedNode) {
      setEditContent(selectedNode.content || '');
    }
  }, [selectedNodeId, nodes]);

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  const handleSave = async () => {
    if (selectedNode) {
      setIsSaving(true);
      const updated = await updateWikiNode(selectedNode.id, { content: editContent });
      setNodes(nodes.map(n => n.id === updated.id ? updated : n));
      setIsEditing(false);
      setIsSaving(false);
    }
  };

  const handleDelete = async (nodeId: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除内容',
      message: '确定要删除此项及其所有子内容吗？此操作不可恢复。',
      onConfirm: async () => {
        await deleteWikiNode(nodeId);
        const freshNodes = await getTeamWikiNodes(id!);
        setNodes(freshNodes);
        if (selectedNodeId === nodeId) {
          setSelectedNodeId(null);
        }
      }
    });
  };

  const handleCreateKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (createName.trim() && id) {
        const newNode = await createWikiNode(id, creating!.parentId, creating!.type, createName.trim());
        setNodes([...nodes, newNode]);
        if (newNode.type === 'document') {
          setSelectedNodeId(newNode.id);
          setIsEditing(true);
        } else {
          setExpandedFolders(new Set(expandedFolders).add(newNode.id));
        }
      }
      setCreating(null);
      setCreateName('');
    } else if (e.key === 'Escape') {
      setCreating(null);
      setCreateName('');
    }
  };

  const renderInlineInput = (level: number, type: 'folder' | 'document') => (
    <div 
      className="flex items-center py-1.5 px-2 text-sm bg-black/40 rounded-lg mx-2 my-0.5 border border-blue-500/50"
      style={{ paddingLeft: `${level * 12 + 8}px` }}
    >
      <div className="flex items-center gap-1.5 w-full">
        {type === 'folder' ? <ChevronRight size={16} className="invisible" /> : <span className="w-4" />}
        {type === 'folder' ? <Folder size={14} className="text-blue-400" /> : <FileText size={14} className="text-white/50" />}
        <input
          ref={inputRef}
          type="text"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onKeyDown={handleCreateKeyDown}
          onBlur={() => { setCreating(null); setCreateName(''); }}
          className="flex-1 bg-transparent outline-none text-white px-1 text-sm placeholder:text-white/30"
          placeholder="输入名称..."
        />
      </div>
    </div>
  );

  const renderTree = (parentId: string | null, level: number = 0) => {
    const children = nodes.filter(n => n.parentId === parentId);
    children.sort((a, b) => {
      if (a.type === b.type) return a.title.localeCompare(b.title);
      return a.type === 'folder' ? -1 : 1;
    });

    if (children.length === 0 && creating?.parentId !== parentId) return null;

    return (
      <>
        {children.map(node => {
          const isExpanded = expandedFolders.has(node.id);
          const isSelected = selectedNodeId === node.id;

          return (
            <div key={node.id}>
              <div 
                className={cn(
                  "group flex items-center justify-between py-1.5 px-2 cursor-pointer text-sm select-none rounded-lg mx-2 my-0.5 transition-colors",
                  isSelected ? "bg-blue-600/40 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => {
                  if (node.type === 'folder') {
                    const newExpanded = new Set(expandedFolders);
                    if (isExpanded) newExpanded.delete(node.id);
                    else newExpanded.add(node.id);
                    setExpandedFolders(newExpanded);
                  } else {
                    setSelectedNodeId(node.id);
                    setIsEditing(false);
                  }
                }}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {node.type === 'folder' ? (
                    isExpanded ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />
                  ) : (
                    <span className="w-4" />
                  )}
                  {node.type === 'folder' ? (
                    <Folder size={14} className="shrink-0 text-blue-400" />
                  ) : (
                    <FileText size={14} className="shrink-0 text-white/50" />
                  )}
                  <span className="truncate">{node.title}</span>
                </div>

                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  {node.type === 'folder' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setCreating({ parentId: node.id, type: 'document' }); setExpandedFolders(new Set(expandedFolders).add(node.id)); }} className="p-1 hover:bg-white/20 rounded text-white/70 hover:text-white" title="新建文件"><FilePlus size={14}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setCreating({ parentId: node.id, type: 'folder' }); setExpandedFolders(new Set(expandedFolders).add(node.id)); }} className="p-1 hover:bg-white/20 rounded text-white/70 hover:text-white" title="新建文件夹"><FolderPlus size={14}/></button>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(node.id); }} className="p-1 hover:bg-red-500/30 rounded text-white/70 hover:text-red-400" title="删除"><Trash2 size={14}/></button>
                </div>
              </div>
              {node.type === 'folder' && isExpanded && (
                <>
                  {creating?.parentId === node.id && renderInlineInput(level + 1, creating.type)}
                  {renderTree(node.id, level + 1)}
                </>
              )}
            </div>
          );
        })}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center z-40">
        <div className="animate-pulse flex flex-col items-center bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
          <Book size={32} className="text-white/50 mb-4" />
          <p className="text-white/70">加载中...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center z-40">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 text-center">
          <h2 className="text-xl font-medium mb-2 text-white">未找到团队</h2>
          <p className="text-white/70">您访问的团队不存在或您没有权限</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex px-4 py-8 w-full max-w-7xl mx-auto h-full overflow-hidden gap-6 z-40">
      {/* Sidebar (Explorer) */}
      <div className="w-64 flex-shrink-0 bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-wider text-white/80">
          <span>资源管理器</span>
          <div className="flex gap-1">
            <button onClick={() => setCreating({ parentId: null, type: 'document' })} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="新建文件"><FilePlus size={16}/></button>
            <button onClick={() => setCreating({ parentId: null, type: 'folder' })} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="新建文件夹"><FolderPlus size={16}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-3 custom-scrollbar">
          {creating?.parentId === null && renderInlineInput(0, creating.type)}
          {renderTree(null)}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {selectedNode && selectedNode.type === 'document' ? (
          <>
            {/* Tabs Bar */}
            <div className="flex bg-white/5 border-b border-white/10 overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-2 px-5 py-3 bg-white/10 text-white border-t-2 border-blue-500 min-w-[120px] max-w-[200px]">
                <FileText size={16} className="text-blue-400 shrink-0" />
                <span className="text-sm font-medium truncate">{selectedNode.title}</span>
              </div>
            </div>
            
            {/* Breadcrumb & Actions */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <span>{team.name}</span>
                <ChevronRight size={14} />
                <span className="text-white/90">{selectedNode.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
                      <Eye size={16} /> 预览
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50">
                      <Save size={16} /> {isSaving ? '保存中' : '保存'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
                    <Code size={16} /> 编辑
                  </button>
                )}
              </div>
            </div>

            {/* Editor / Preview Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full min-h-full bg-transparent text-white p-8 font-mono text-base resize-none outline-none leading-relaxed placeholder:text-white/20"
                  placeholder="在此输入 Markdown 内容..."
                  spellCheck={false}
                />
              ) : (
                <div className="p-8 prose prose-invert max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-a:text-blue-400 hover:prose-a:text-blue-300">
                  {selectedNode.content ? (
                    <ReactMarkdown>{selectedNode.content}</ReactMarkdown>
                  ) : (
                    <div className="text-center py-20 text-white/40">
                      <p>文档内容为空，点击右上角"编辑"开始编写。</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/40">
            <div className="text-center">
              <File size={64} className="mx-auto mb-4 opacity-20" />
              <p>选择一个文件进行查看或编辑</p>
            </div>
          </div>
        )}
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
