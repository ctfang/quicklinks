import type { WikiNode } from '../src/services/api';
import { parseKnowledgeDocument } from '../src/lib/knowledgeDocument';
export type { WikiNode } from '../src/services/api';
let sequence = 0;
let nodes = [
  { id: 'folder', teamId: 'qa-team', parentId: null, type: 'folder', title: '产品资料', content: '' },
  { id: 'intro', teamId: 'qa-team', parentId: null, type: 'document', title: '团队知识库使用说明', content: '# 团队知识库\n\n统一维护文档、表格和项目画布。' },
] as WikiNode[];
export const getTeamWikiNodes = async () => nodes.map(({ content, ...node }) => ({ ...node, documentKind: node.type === 'document' ? parseKnowledgeDocument(content || '').kind : undefined }));
export const getWikiNode = async (id: string) => structuredClone(nodes.find(node => node.id === id)!);
export const createWikiNode = async (teamId: string, parentId: string | null, type: 'folder' | 'document', title: string) => {
  const node = { id: `qa-${++sequence}`, teamId, parentId, type, title, content: '' } as WikiNode;
  nodes.push(node);
  return structuredClone(node);
};
export const updateWikiNode = async (id: string, updates: Partial<WikiNode>) => {
  nodes = nodes.map(node => node.id === id ? { ...node, ...updates } : node);
  return structuredClone(nodes.find(node => node.id === id)!);
};
export const deleteWikiNode = async (id: string) => { nodes = nodes.filter(node => node.id !== id); };
