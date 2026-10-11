import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getTeamWikiNodes, getWikiNode, createWikiNode, updateWikiNode, deleteWikiNode, WikiNode } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { Save, Book, Folder, FileText, ChevronRight, Trash2, FolderPlus, FilePlus, Eye, Code, File, Upload as UploadIcon, Download, PenTool, Table2, ArrowLeft, Home, MoreHorizontal } from 'lucide-react';
import { KnowledgeDocumentView } from '../components/KnowledgeDocumentView';
import { createKnowledgeDocument, documentLabels, documentContentLimit, parseKnowledgeDocument, type DocumentKind } from '../lib/knowledgeDocument';
import { importKnowledgeFile, exportKnowledgeFile, knowledgeImportAccept } from '../lib/knowledgeOffice';

import { ConfirmModal } from '../components/ConfirmModal';
import { Alert, Button, Drawer, Dropdown, Empty, Input, Modal, Select, Spin, Tree, Upload } from 'antd';
import type { InputRef, MenuProps, TreeDataNode } from 'antd';

export const Wiki = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKind = searchParams.get('new');
  const { teams } = useAppContext();
  const [nodes, setNodes] = useState<WikiNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [documentLoadState, setDocumentLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const documentRequest = useRef(0);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [compactLayout, setCompactLayout] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px), (max-height: 600px)').matches);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [error, setError] = useState('');
  const [editContent, setEditContent] = useState('');
  const [importTarget, setImportTarget] = useState<{ parentId: string | null } | null>(null);
  const [newDocumentKind, setNewDocumentKind] = useState<DocumentKind>('markdown');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // 新建文件与目录
  const [creating, setCreating] = useState<{ parentId: string | null, type: 'folder' | 'document' } | null>(null);
  const [createName, setCreateName] = useState('');
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 1023px), (max-height: 600px)');
    const updateLayout = () => { setCompactLayout(query.matches); setExplorerOpen(false); };
    query.addEventListener('change', updateLayout);
    return () => query.removeEventListener('change', updateLayout);
  }, []);

  // Confirm Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const team = teams.find(t => t.id === id);
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const activeFolder = selectedNode?.type === 'folder' ? selectedNode.id : selectedNode?.parentId || null;
  const documentTypes: { kind: DocumentKind; description: string; icon: typeof FileText }[] = [
    { kind: 'word', description: '富文本文档、表格与图片', icon: FileText },
    { kind: 'sheet', description: '多工作表、公式与数据', icon: Table2 },
    { kind: 'canvas', description: '流程图、架构图与自由绘图', icon: PenTool },
    { kind: 'markdown', description: '技术文档与 Markdown 笔记', icon: Code },
  ];
  const nodeIcon = (node: WikiNode) => {
    if (node.type === 'folder') return Folder;
    try { const kind = node.documentKind || parseKnowledgeDocument(node.content || '').kind; return kind === 'sheet' ? Table2 : kind === 'canvas' ? PenTool : kind === 'markdown' ? Code : FileText; }
    catch { return File; }
  };
  const dirty = isEditing && !!selectedNode && editContent !== (selectedNode.content || '');
  const runAfterDraftCheck = (action: () => void) => {
    if (isSaving || isImporting || isCreating) return;
    if (!dirty) { action(); return; }
    setConfirmModalConfig({ isOpen: true, title: '放弃未保存的修改？', message: '当前文档有未保存的修改，继续操作将放弃这些修改。', isDestructive: false, onConfirm: action });
  };
  let selectedKind: string = 'markdown';
  try { selectedKind = parseKnowledgeDocument(isEditing ? editContent : selectedNode?.content || '').kind; } catch { selectedKind = 'invalid'; }

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    let cancelled = false;
    documentRequest.current++;
    setDocumentLoadState('idle');
    if (id) {
      setError('');
      setIsLoading(true);
      setNodes([]);
      setSelectedNodeId(null);
      setIsEditing(false);
      getTeamWikiNodes(id).then(data => {
        if (cancelled) return;
        const nodesList = data ?? [];
        setNodes(nodesList);
        const roots = nodesList.filter(n => n.parentId === null && n.type === 'folder');
        setExpandedFolders(new Set(roots.map(r => r.id)));
        
      }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : '知识库加载失败，请刷新重试'); }).finally(() => { if (!cancelled) setIsLoading(false); });
    }
    return () => { cancelled = true; documentRequest.current++; };
  }, [id]);

  useEffect(() => {
    if (selectedNode && !isEditing) {
      setEditContent(selectedNode.content || '');
    }
  }, [selectedNodeId, nodes, isEditing]);

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  const handleSave = async () => {
    if (selectedNode && !isSaving) {
      setIsSaving(true);
      setError('');
      try {
        if (new Blob([editContent]).size > documentContentLimit) throw new Error('文档内容超过 3 MB，请减少嵌入图片或拆分文档后保存。');
        const updated = await updateWikiNode(selectedNode.id, { content: editContent });
        setNodes(previous => previous.map(n => n.id === updated.id ? updated : n));
        setIsEditing(false);
        setIsPreview(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存失败，请重试');
      } finally { setIsSaving(false); }
    }
  };

  const handleDelete = async (nodeId: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: '删除内容',
      message: '确定要删除此项及其所有子内容吗？此操作不可恢复。',
      isDestructive: true,
      onConfirm: async () => {
        setError('');
        try {
          await deleteWikiNode(nodeId);
          const freshNodes = await getTeamWikiNodes(id!);
          setNodes(previous => {
            const existing = new Map(previous.map(node => [node.id, node]));
            return freshNodes.map(node => ({ ...existing.get(node.id), ...node }));
          });
          if (!freshNodes.some(node => node.id === selectedNodeId)) {
            setSelectedNodeId(null);
            setIsEditing(false);
          }
        } catch (err) { setError(err instanceof Error ? err.message : '删除失败，请重试'); }
      }
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !id || !creating || isCreating) return;
    documentRequest.current++;
    setDocumentLoadState('idle');
    setIsCreating(true);
    setError('');
    try {
      let newNode = await createWikiNode(id, creating.parentId, creating.type, createName.trim());
      let initialContent = '';
      if (newNode.type === 'document' && newDocumentKind !== 'markdown') {
        initialContent = createKnowledgeDocument(newDocumentKind);
        try { newNode = await updateWikiNode(newNode.id, { content: initialContent }); }
        catch (err) {
          // 首次类型保存失败时保留已经创建的节点和草稿，允许用户重试保存。
          setError(err instanceof Error ? err.message : '新文档初始化失败，请点击保存重试');
        }
      }
      setNodes(previous => [...previous, newNode]);
      if (newNode.parentId) setExpandedFolders(previous => new Set(previous).add(newNode.parentId!));
      if (newNode.type === 'document') {
        setSelectedNodeId(newNode.id);
        setEditContent(initialContent || newNode.content || '');
        setIsEditing(true);
        setIsPreview(false);
      } else {
        setExpandedFolders(previous => new Set(previous).add(newNode.id));
      }
      setCreating(null);
      setCreateName('');
    } catch (err) { setError(err instanceof Error ? err.message : '创建失败，请重试'); }
    finally { setIsCreating(false); }
  };

  const startCreate = (kind: DocumentKind, parentId: string | null = null) => runAfterDraftCheck(() => {
    setIsEditing(false);
    setNewDocumentKind(kind);
    setCreating({ parentId, type: 'document' });
    setCreateName('');
    if (parentId) setExpandedFolders(previous => new Set(previous).add(parentId));
  });

  useEffect(() => {
    if (isLoading || !team || !requestedKind || !['markdown', 'word', 'sheet', 'canvas'].includes(requestedKind)) return;
    setIsEditing(false);
    setNewDocumentKind(requestedKind as DocumentKind);
    setCreating({ parentId: null, type: 'document' });
    setCreateName('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('new');
    setSearchParams(nextParams, { replace: true });
  }, [isLoading, team?.id, requestedKind, searchParams, setSearchParams]);

  const handleImport = async (file: File, parentId: string | null) => {
    if (!id || isImporting) return;
    documentRequest.current++;
    setDocumentLoadState('idle');
    setIsImporting(true);
    setError('');
    let created: WikiNode | null = null;
    let content = '';
    try {
      content = await importKnowledgeFile(file);
      if (new Blob([content]).size > documentContentLimit) throw new Error('转换后的文档超过 3 MB，请减少嵌入内容后重试。');
      created = await createWikiNode(id, parentId, 'document', file.name);
      const updated = await updateWikiNode(created.id, { content });
      setNodes(previous => [...previous, updated]);
      if (parentId) setExpandedFolders(previous => new Set(previous).add(parentId));
      setSelectedNodeId(updated.id);
      setEditContent(content);
      setIsEditing(false);
      setIsPreview(false);
    } catch (err) {
      if (created) {
        setNodes(previous => [...previous, created!]);
        setSelectedNodeId(created.id);
        setEditContent(content);
        setIsEditing(true);
        setIsPreview(false);
      }
      setError(err instanceof Error ? err.message : '导入失败，请重试');
    } finally { setIsImporting(false); }
  };

  const handleExport = async () => {
    if (!selectedNode || isExporting) return;
    setIsExporting(true);
    setError('');
    try { await exportKnowledgeFile(isEditing ? editContent : selectedNode.content || '', selectedNode.title); }
    catch (err) { setError(err instanceof Error ? err.message : '导出失败'); }
    finally { setIsExporting(false); }
  };

  const selectDocument = (node: WikiNode) => {
    if (!id || (node.id === selectedNodeId && documentLoadState !== 'error')) return;
    runAfterDraftCheck(() => {
      const request = ++documentRequest.current;
      setExplorerOpen(false);
      setSelectedNodeId(node.id);
      setEditContent('');
      setIsEditing(false);
      setIsPreview(false);
      setError('');
      if (node.type === 'folder') { setDocumentLoadState('idle'); return; }
      setDocumentLoadState('loading');
      void getWikiNode(node.id).then(freshNode => {
        if (request !== documentRequest.current) return;
        if (freshNode.teamId !== id || freshNode.type !== 'document') throw new Error('文档已删除或不可访问，请重新打开知识库。');
        setNodes(previous => previous.map(item => item.id === freshNode.id ? freshNode : item));
        setEditContent(freshNode.content || '');
        setDocumentLoadState('idle');
      }).catch(err => {
        if (request !== documentRequest.current) return;
        setError(err instanceof Error ? err.message : '文档加载失败，请重试');
        setDocumentLoadState('error');
      });
    });
  };

  const contextMenu = (parentId: string | null, node?: WikiNode): MenuProps => ({
    items: [
      { key: 'location', label: node?.type === 'folder' ? node.title : nodes.find(item => item.id === parentId)?.title || '知识库根目录', disabled: true },
      ...documentTypes.map(({ kind, icon: Icon }) => ({ key: kind, label: `新建 ${documentLabels[kind]}`, icon: <Icon size={16} />, disabled: isSaving || isImporting || isCreating })),
      { key: 'folder', label: '新建文件夹', icon: <FolderPlus size={16} />, disabled: isSaving || isImporting || isCreating },
      { key: 'import', label: '导入文件到此目录', icon: <UploadIcon size={16} />, disabled: isSaving || isImporting || isCreating },
      ...(node ? [{ type: 'divider' as const }, { key: 'open', label: node.type === 'folder' ? '打开文件夹' : '打开文件', icon: <Folder size={16} /> }, { key: 'delete', label: '删除', danger: true, icon: <Trash2 size={16} />, disabled: isSaving || isImporting || isCreating }] : []),
    ],
    onClick: ({ key, domEvent }) => {
      domEvent?.stopPropagation();
      if (documentTypes.some(item => item.kind === key)) startCreate(key as DocumentKind, parentId);
      else if (key === 'folder') runAfterDraftCheck(() => { setCreating({ parentId, type: 'folder' }); setCreateName(''); });
      else if (key === 'import') setImportTarget({ parentId });
      else if (key === 'open' && node) selectDocument(node);
      else if (key === 'delete' && node) handleDelete(node.id);
    },
  });
  const treeData = (parentId: string | null): TreeDataNode[] => nodes.filter(node => node.parentId === parentId)
    .sort((a, b) => a.type === b.type ? a.title.localeCompare(b.title) : a.type === 'folder' ? -1 : 1)
    .map(node => {
      const menu = contextMenu(node.type === 'folder' ? node.id : node.parentId, node);
      return { key: node.id, isLeaf: node.type !== 'folder', children: node.type === 'folder' ? treeData(node.id) : undefined,
        title: <Dropdown trigger={['contextMenu']} menu={menu}>
          <div className="knowledge-tree-title" onContextMenu={event => event.stopPropagation()}>
            {React.createElement(nodeIcon(node), { size: 15 })}<span className="truncate">{node.title}</span>
            <Dropdown trigger={['click']} menu={menu}><Button type="text" size="small" aria-label={`${node.title} 的操作菜单`} className="knowledge-node-menu" icon={<MoreHorizontal size={15} />} onClick={event => event.stopPropagation()} /></Dropdown>
          </div>
        </Dropdown>,
      };
    });

  const renderCreateDialog = (type: 'folder' | 'document') => (
    <Modal open centered getContainer={false} width={560} footer={null} className="knowledge-create-modal" afterOpenChange={open => { if (open) inputRef.current?.focus(); }} title={type === 'folder' ? '新建文件夹' : '新建文件'}
      closable={!isCreating} keyboard={!isCreating} mask={{ closable: !isCreating }} onCancel={() => { setCreating(null); setCreateName(''); }}>
    <form onSubmit={handleCreate}
      className="knowledge-create-dialog"
    >
      <p>为 {team?.name} 创建内容，保存到团队知识库。</p>
      {type === 'document' && <div className="knowledge-create-types">{documentTypes.map(({ kind, icon: Icon }) => <Button key={kind} htmlType="button" aria-pressed={newDocumentKind === kind} disabled={isCreating} onClick={() => setNewDocumentKind(kind)}><Icon size={20} />{documentLabels[kind]}</Button>)}</div>}
      <label className="knowledge-field">{type === 'folder' ? '文件夹名称' : '文件名称'}
        <Input
          ref={inputRef}
          type="text"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape' && !isCreating) { setCreating(null); setCreateName(''); } }}
          disabled={isCreating}
          aria-label={type === 'folder' ? '文件夹名称' : '文档名称'}
          className="knowledge-name-input"
          placeholder={type === 'folder' ? '例如：产品资料' : '例如：项目实施方案'}
        />
      </label>
      <div className="knowledge-field"><label htmlFor="knowledge-parent-folder">保存位置</label><Select id="knowledge-parent-folder" aria-label="保存位置" disabled={isCreating} value={creating?.parentId || ''} getPopupContainer={trigger => trigger.parentElement!} onChange={value => setCreating(previous => previous ? { ...previous, parentId: value || null } : null)} options={[{ value: '', label: '知识库根目录' }, ...nodes.filter(node => node.type === 'folder').map(node => ({ value: node.id, label: node.title }))]} /></div>
      {error && <Alert type="error" showIcon title={error} className="knowledge-create-error" />}
      <div className="knowledge-create-actions"><Button htmlType="button" disabled={isCreating} onClick={() => { setCreating(null); setCreateName(''); }} aria-label="取消创建" className="knowledge-button">取消</Button><Button htmlType="submit" loading={isCreating} disabled={!createName.trim()} aria-label="确认创建" type="primary" className="knowledge-button">{isCreating ? '正在创建…' : '创建并打开'}</Button></div>
    </form>
    </Modal>
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center z-40">
        <Spin description="加载知识库…" />
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

  const explorer = (
      <div className="wiki-sidebar knowledge-explorer">
        <div className="knowledge-space-title"><span className="knowledge-space-icon"><Book size={22} /></span><div><strong>{team.name}</strong><span>团队知识库</span></div></div>
        {isImporting && <div role="status" className="px-4 py-2 text-sm">正在导入文档…</div>}
        <Dropdown trigger={['contextMenu']} menu={contextMenu(null)}>
          <div className="knowledge-directory-tree flex-1 overflow-y-auto py-3 custom-scrollbar" aria-label="知识库文件目录">
            <Tree blockNode showLine={{ showLeafIcon: false }} treeData={treeData(null)}
              selectedKeys={selectedNodeId ? [selectedNodeId] : []} expandedKeys={[...expandedFolders]}
              onExpand={keys => setExpandedFolders(new Set(keys.map(String)))}
              onSelect={(_, info) => { const node = nodes.find(item => item.id === info.node.key); if (node) selectDocument(node); }} />
            {!nodes.length && <p className="knowledge-directory-hint">右键此处新建文件或文件夹</p>}
          </div>
        </Dropdown>
        <div className="knowledge-explorer-footer">
          <nav aria-label="知识库导航" className="knowledge-footer-navigation">
            <Button type="text" href="/wiki" icon={<ArrowLeft size={16} />}>全部知识库</Button>
            <Button type="text" href="/" icon={<Home size={16} />}>导航首页</Button>
          </nav>
          <span className="knowledge-footer-summary">团队成员共享 · {nodes.length} 项内容</span>
        </div>
      </div>
  );

  return (
    <div className={`wiki-editor flex-1 flex w-full min-h-0 overflow-hidden${compactLayout ? ' is-compact' : ''}`}>
      {compactLayout ? <Drawer title="知识库目录" placement="left" open={explorerOpen} onClose={() => setExplorerOpen(false)} size="min(320px, 90vw)" getContainer={false} styles={{ body: { padding: 0, display: 'flex' } }} className="knowledge-directory-drawer">{explorer}</Drawer> : explorer}
      {/* Main Editor Area */}
      <div className="wiki-content min-w-0 flex-1 flex flex-col bg-slate-950 overflow-hidden">
        {error && <Alert type="error" title={error} showIcon closable onClose={() => setError('')} />}
        {selectedNode && selectedNode.type === 'document' ? (
          <>
            {/* Breadcrumb & Actions */}
            <div className="wiki-toolbar knowledge-file-header">
              <div className="knowledge-file-title-row">{compactLayout && <Button aria-label="打开知识库目录" aria-expanded={explorerOpen} icon={<Folder size={18} />} onClick={() => setExplorerOpen(true)} />}<div className="knowledge-file-heading"><div className="knowledge-file-path">{team.name}<ChevronRight size={12} />{nodes.find(node => node.id === selectedNode.parentId)?.title || '全部文件'}<ChevronRight size={12} />{documentLabels[selectedKind] || '文档'}</div><h1><span className="knowledge-file-title" title={selectedNode.title}>{selectedNode.title}</span><span className="knowledge-draft-status">{dirty ? '未保存' : isEditing ? '编辑中' : '已保存'}</span></h1></div></div>
              <div className="knowledge-file-actions flex items-center gap-2">
                <Button htmlType="button" onClick={handleExport} disabled={documentLoadState !== 'idle'} loading={isExporting} className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg disabled:opacity-50"><Download size={16} />{isExporting ? '导出中' : selectedKind === 'invalid' ? '导出原始数据' : '导出'}</Button>
                {isEditing ? (
                  <>
                    <Button onClick={() => setIsPreview(!isPreview)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
                      <Eye size={16} /> {isPreview ? '继续编辑' : '预览'}
                    </Button>
                    <Button type="primary" onClick={handleSave} loading={isSaving} className="knowledge-save-button">
                      <Save size={16} /> {isSaving ? '保存中' : '保存'}
                    </Button>
                  </>
                ) : (
                  selectedKind !== 'file' && selectedKind !== 'invalid' && <Button disabled={documentLoadState !== 'idle'} onClick={() => { setIsEditing(true); setIsPreview(false); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
                    <Code size={16} /> 编辑
                  </Button>
                )}
              </div>
            </div>

            {/* Editor / Preview Content */}
            <div className="knowledge-document-area min-h-0 flex-1 overflow-y-auto custom-scrollbar" onKeyDownCapture={event => {
              if (isEditing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                event.stopPropagation();
                if (!isSaving) void handleSave();
              }
            }}>
              {documentLoadState === 'loading' ? <div role="status" className="flex items-center justify-center p-8"><Spin description="加载文档…" /></div> : documentLoadState === 'error' ? <Empty description="文档加载失败"><Button onClick={() => selectDocument(selectedNode)}>重新加载</Button></Empty> : <KnowledgeDocumentView key={`${selectedNode.id}_${isEditing}_${isPreview}`} value={isEditing ? editContent : selectedNode.content || ''}
                editing={isEditing} preview={isPreview} disabled={isSaving}
                onChange={setEditContent} onSave={handleSave} />}
            </div>
          </>
        ) : (
          <div className="knowledge-library-home">
            {compactLayout && <Button className="knowledge-home-directory" icon={<Folder size={16} />} onClick={() => setExplorerOpen(true)}>打开目录</Button>}
            <div className="knowledge-library-intro"><span>{team.name} / {selectedNode?.title || '全部文件'}</span><h1>{selectedNode?.title || '团队知识工作台'}</h1><p>集中管理团队文档、业务表格和自由画布。</p></div>
            <div className="knowledge-quick-create">{documentTypes.map(({ kind, description, icon: Icon }) => <Button key={kind} htmlType="button" onClick={() => startCreate(kind, activeFolder)}><Icon size={24} /><strong>{documentLabels[kind]}</strong><span>{description}</span><small>新建 <FilePlus size={13} /></small></Button>)}</div>
            <div className="knowledge-files-heading"><h2>{selectedNode?.title || '全部文件'}</h2><span>{nodes.filter(node => node.parentId === activeFolder).length} 项</span></div>
            <div className="knowledge-file-list">{nodes.filter(node => node.parentId === activeFolder).map(node => <Dropdown key={node.id} trigger={['contextMenu']} menu={contextMenu(node.type === 'folder' ? node.id : node.parentId, node)}><Button type="text" htmlType="button" onClick={() => selectDocument(node)}>{React.createElement(nodeIcon(node), { size: 20 })}<span>{node.title}</span><small>{node.type === 'folder' ? '文件夹' : (() => { try { return documentLabels[node.documentKind || parseKnowledgeDocument(node.content || '').kind]; } catch { return '文件'; } })()}</small><ChevronRight size={15} /></Button></Dropdown>)}</div>
            {!nodes.some(node => node.parentId === activeFolder) && <Empty className="knowledge-files-empty" description="这里还没有文件，可选择内容类型新建或导入已有文件。" />}
          </div>
        )}
      </div>

      {creating && renderCreateDialog(creating.type)}
      <Modal open={Boolean(importTarget)} title="导入文件" footer={null} getContainer={false} onCancel={() => setImportTarget(null)}>
        <p className="mb-4 text-sm">保存到：{nodes.find(node => node.id === importTarget?.parentId)?.title || '知识库根目录'}</p>
        <Upload.Dragger accept={knowledgeImportAccept} showUploadList={false} multiple={false} beforeUpload={file => {
          if (importTarget) { const parentId = importTarget.parentId; setImportTarget(null); runAfterDraftCheck(() => { void handleImport(file, parentId); }); }
          return false;
        }}><UploadIcon size={28} className="mx-auto mb-3" /><p>点击选择文件，或拖拽文件到此处</p><p className="text-xs mt-2">支持 DOCX、XLSX、Markdown、PDF、图片和画布，文件不超过 2 MB。</p></Upload.Dragger>
      </Modal>
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        isDestructive={confirmModalConfig.isDestructive}
      />
    </div>
  );
};
