import type { Sheet } from '@fortune-sheet/core';

const prefix = 'quicklinks-document:v1\n';
export const importFileLimit = 2 * 1024 * 1024;
export const documentContentLimit = 3 * 1024 * 1024;
export type DocumentKind = 'markdown' | 'word' | 'sheet' | 'canvas';
export type KnowledgeDocument =
  | { kind: 'markdown'; text: string }
  | { kind: 'word'; html: string }
  | { kind: 'sheet'; sheets: Sheet[] }
  | { kind: 'canvas'; scene: { elements: any[]; appState: Record<string, any>; files: Record<string, any> } }
  | { kind: 'file'; name: string; mime: string; data: string };

export const documentLabels = { markdown: 'Markdown', word: 'Word 文档', sheet: 'Excel 表格', canvas: '自由画布', file: '附件' };

export function parseKnowledgeDocument(content: string): KnowledgeDocument {
  if (!content.startsWith(prefix)) return { kind: 'markdown', text: content };
  const value = JSON.parse(content.slice(prefix.length));
  if (value.kind === 'word' && typeof value.html === 'string') return value;
  if (value.kind === 'sheet' && Array.isArray(value.sheets) && value.sheets.length && value.sheets.every((sheet: Sheet) => typeof sheet.name === 'string')) return value;
  if (value.kind === 'canvas' && Array.isArray(value.scene?.elements) && value.scene.appState && value.scene.files) return value;
  if (value.kind === 'file' && typeof value.name === 'string' && /^data:(application\/pdf|image\/(png|jpeg|gif|webp));base64,[A-Za-z0-9+/=]+$/.test(value.data) && value.data.startsWith(`data:${value.mime};`)) return value;
  throw new Error('文档格式无效，请下载原始数据后恢复，避免覆盖内容。');
}

export function serializeKnowledgeDocument(document: KnowledgeDocument): string {
  return document.kind === 'markdown' ? document.text : prefix + JSON.stringify(document);
}

export function createKnowledgeDocument(kind: DocumentKind): string {
  if (kind === 'word') return serializeKnowledgeDocument({ kind, html: '<p></p>' });
  if (kind === 'sheet') return serializeKnowledgeDocument({ kind, sheets: [{ name: '工作表1', id: 'sheet-1', order: 0, status: 1, row: 100, column: 26, celldata: [] }] });
  if (kind === 'canvas') return serializeKnowledgeDocument({ kind, scene: { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} } });
  return '';
}

export function knowledgeSearchText(content: string): string {
  try {
    const document = parseKnowledgeDocument(content);
    if (document.kind === 'markdown') return document.text;
    if (document.kind === 'word') return document.html.replace(/<[^>]*>/g, ' ');
    if (document.kind === 'file') return document.name;
    if (document.kind === 'canvas') return document.scene.elements.map(element => element.text || '').join(' ');
    return document.sheets.map(sheet => `${sheet.name} ${(sheet.data || []).flat().map(cell => cell?.m ?? cell?.v ?? '').join(' ')} ${(sheet.celldata || []).map(cell => cell.v?.m ?? cell.v?.v ?? '').join(' ')}`).join(' ');
  } catch { return ''; }
}

export function downloadKnowledgeBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
