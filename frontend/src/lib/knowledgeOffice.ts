import type { Cell, Sheet } from '@fortune-sheet/core';
import DOMPurify from 'dompurify';
import { importFileLimit, parseKnowledgeDocument, serializeKnowledgeDocument, downloadKnowledgeBlob, type KnowledgeDocument } from './knowledgeDocument';

export const knowledgeImportAccept = '.md,.markdown,.txt,.docx,.xlsx,.excalidraw,.pdf,.png,.jpg,.jpeg,.gif,.webp';

export async function importKnowledgeFile(file: File): Promise<string> {
  if (file.size > importFileLimit) throw new Error('单个导入文件不能超过 2 MB。');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (['md', 'markdown', 'txt'].includes(extension)) return file.text();
  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return serializeKnowledgeDocument({ kind: 'word', html: DOMPurify.sanitize(result.value) });
  }
  if (extension === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    let count = 0;
    const sheets: Sheet[] = workbook.worksheets.map((worksheet, index) => {
      if (worksheet.rowCount > 10000 || worksheet.columnCount > 256) throw new Error('表格过大，最多支持 10000 行、256 列。');
      const celldata: Sheet['celldata'] = [];
      worksheet.eachRow((row, r) => row.eachCell((cell, c) => {
        if (++count > 100000) throw new Error('表格过大，最多支持 100000 个非空单元格。');
        let value: any = cell.value;
        const formula = typeof value === 'object' && value && 'formula' in value ? cell.formula : undefined;
        if (value instanceof Date) value = value.toISOString().slice(0, 10);
        else if (typeof value === 'object' && value) value = value.result ?? (value.richText ? value.richText.map((part: any) => part.text).join('') : value.text ?? value.error ?? '');
        const v: Cell = { v: value, m: String(value ?? ''), ...(formula ? { f: `=${formula}` } : {}),
          ct: { fa: cell.numFmt || 'General', t: typeof value === 'number' ? 'n' : 'g' },
          bl: cell.font?.bold ? 1 : 0, it: cell.font?.italic ? 1 : 0,
          ...(cell.font?.name ? { ff: cell.font.name } : {}),
          ...(cell.font?.size ? { fs: cell.font.size } : {}),
          ...(cell.font?.color?.argb ? { fc: `#${cell.font.color.argb.slice(-6)}` } : {}),
          ...(cell.fill?.type === 'pattern' && cell.fill.fgColor?.argb ? { bg: `#${cell.fill.fgColor.argb.slice(-6)}` } : {}),
          ...(cell.alignment?.horizontal ? { ht: ({ center: 0, left: 1, right: 2 } as Record<string, number>)[cell.alignment.horizontal] ?? 1 } : {}),
          ...(cell.alignment?.vertical ? { vt: ({ center: 0, top: 1, bottom: 2 } as Record<string, number>)[cell.alignment.vertical] ?? 2 } : {}),
        };
        celldata.push({ r: r - 1, c: c - 1, v });
      }));
      const merge: NonNullable<Sheet['config']>['merge'] = {};
      Object.values(worksheet.model.merges || []).forEach(range => {
        const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
        if (!match) return;
        const column = (letters: string) => [...letters].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
        const r = Number(match[2]) - 1, c = column(match[1]);
        merge[`${r}_${c}`] = { r, c, rs: Number(match[4]) - r, cs: column(match[3]) - c + 1 };
      });
      const rowlen: Record<string, number> = {}, columnlen: Record<string, number> = {};
      worksheet.eachRow((row, index) => { if (row.height) rowlen[String(index - 1)] = row.height * 4 / 3; });
      worksheet.columns.forEach((column, index) => { if (column.width) columnlen[String(index)] = column.width * 7; });
      return { name: worksheet.name, id: `sheet-${index}`, status: index === 0 ? 1 : 0, order: index, row: Math.max(100, worksheet.rowCount), column: Math.max(26, worksheet.columnCount), celldata, config: { merge, rowlen, columnlen } };
    });
    if (!sheets.length) throw new Error('Excel 文件中没有工作表。');
    return serializeKnowledgeDocument({ kind: 'sheet', sheets });
  }
  if (extension === 'excalidraw') {
    const scene = JSON.parse(await file.text());
    if (scene.type !== 'excalidraw' || !Array.isArray(scene.elements)) throw new Error('无效的 Excalidraw 文件。');
    return serializeKnowledgeDocument({ kind: 'canvas', scene: { elements: scene.elements, appState: scene.appState || { viewBackgroundColor: '#ffffff' }, files: scene.files || {} } });
  }
  const mime = ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' } as Record<string, string>)[extension];
  if (!mime) throw new Error('暂不支持此文件格式，请导入 Markdown、TXT、DOCX、XLSX、PDF、图片或 Excalidraw 文件。');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, `data:${mime};`));
    reader.onerror = () => reject(new Error('文件读取失败。'));
    reader.readAsDataURL(file);
  });
  return serializeKnowledgeDocument({ kind: 'file', name: file.name, mime, data });
}

export async function exportKnowledgeFile(content: string, title: string) {
  let document: KnowledgeDocument;
  try { document = parseKnowledgeDocument(content); }
  catch { return downloadKnowledgeBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${title.replace(/[<>:"/\\|?*]/g, '_')}.quicklinks.txt`); }
  const name = title.replace(/[<>:"/\\|?*]/g, '_').replace(/\.(docx|xlsx|excalidraw|md)$/i, '') || '文档';
  if (document.kind === 'markdown') return downloadKnowledgeBlob(new Blob([document.text], { type: 'text/markdown;charset=utf-8' }), `${name}.md`);
  if (document.kind === 'canvas') return downloadKnowledgeBlob(new Blob([JSON.stringify({ type: 'excalidraw', version: 2, source: 'quicklinks', ...document.scene })], { type: 'application/json' }), `${name}.excalidraw`);
  if (document.kind === 'file') {
    const bytes = Uint8Array.from(atob(document.data.split(',')[1]), char => char.charCodeAt(0));
    return downloadKnowledgeBlob(new Blob([bytes], { type: document.mime }), document.name);
  }
  if (document.kind === 'sheet') {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    document.sheets.forEach(sheet => {
      const worksheet = workbook.addWorksheet(sheet.name);
      const cells = sheet.data ? sheet.data.flatMap((row, r) => (row || []).map((v, c) => ({ r, c, v }))) : sheet.celldata || [];
      cells.forEach(({ r, c, v }) => {
        if (!v) return;
        const cell = worksheet.getCell(r + 1, c + 1);
        const value = typeof v === 'object' ? v : { v };
        cell.value = value.f ? { formula: value.f.replace(/^=/, ''), result: value.v as any } : value.v ?? value.m ?? null;
        cell.font = { bold: value.bl === 1, italic: value.it === 1, size: Number(value.fs) || 11, ...(typeof value.ff === 'string' ? { name: value.ff } : {}),
          ...(value.fc ? { color: { argb: `FF${value.fc.replace('#', '')}` } } : {}) };
        if (value.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${value.bg.replace('#', '')}` } };
        cell.alignment = { ...(value.ht !== undefined ? { horizontal: (['center', 'left', 'right'] as const)[value.ht] } : {}), ...(value.vt !== undefined ? { vertical: (['middle', 'top', 'bottom'] as const)[value.vt] } : {}) };
        if (value.ct?.fa) cell.numFmt = value.ct.fa;
      });
      Object.values(sheet.config?.merge || {}).forEach(merge => worksheet.mergeCells(merge.r + 1, merge.c + 1, merge.r + merge.rs, merge.c + merge.cs));
      Object.entries(sheet.config?.rowlen || {}).forEach(([index, height]) => { worksheet.getRow(Number(index) + 1).height = height * 3 / 4; });
      Object.entries(sheet.config?.columnlen || {}).forEach(([index, width]) => { worksheet.getColumn(Number(index) + 1).width = width / 7; });
    });
    return downloadKnowledgeBlob(new Blob([await workbook.xlsx.writeBuffer() as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}.xlsx`);
  }
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, ExternalHyperlink, ImageRun } = await import('docx');
  const root = new DOMParser().parseFromString(DOMPurify.sanitize(document.html), 'text/html');
  type Runs = InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink> | InstanceType<typeof ImageRun>;
  const runs = (node: Node, marks: { bold?: boolean; italics?: boolean; underline?: {} } = {}): Runs[] => {
    if (node.nodeType === Node.TEXT_NODE) return [new TextRun({ text: node.textContent || '', ...marks })];
    if (!(node instanceof Element)) return [];
    if (node.tagName === 'BR') return [new TextRun({ break: 1 })];
    if (node.tagName === 'IMG') {
      const match = /^data:image\/(png|jpeg|gif);base64,(.+)$/.exec(node.getAttribute('src') || '');
      if (!match) return [];
      return [new ImageRun({ type: match[1] === 'jpeg' ? 'jpg' : match[1] as 'png' | 'gif', data: Uint8Array.from(atob(match[2]), char => char.charCodeAt(0)), transformation: { width: 450, height: 300 } })];
    }
    const next = { ...marks, ...(['B', 'STRONG'].includes(node.tagName) ? { bold: true } : {}), ...(['I', 'EM'].includes(node.tagName) ? { italics: true } : {}), ...(node.tagName === 'U' ? { underline: {} } : {}) };
    const children = [...node.childNodes].flatMap(child => runs(child, next));
    if (node.tagName === 'A' && /^https?:\/\//.test(node.getAttribute('href') || '')) return [new ExternalHyperlink({ link: node.getAttribute('href'), children })];
    return children;
  };
  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const blocks = (element: Element): Block[] => [...element.children].flatMap<Block>(child => {
    if (child.tagName === 'TABLE') return [new Table({ rows: [...child.querySelectorAll('tr')].map(row => new TableRow({ children: [...row.children].map(cell => new TableCell({ children: blocks(cell).length ? blocks(cell) : [new Paragraph({ children: runs(cell) })] })) })) })];
    if (['UL', 'OL'].includes(child.tagName)) return [...child.children].map((item, index) => new Paragraph({ children: child.tagName === 'OL' ? [new TextRun(`${index + 1}. `), ...runs(item)] : runs(item), ...(child.tagName === 'UL' ? { bullet: { level: 0 } } : {}) }));
    const level = /^H([1-6])$/.exec(child.tagName);
    return [new Paragraph({ children: runs(child), ...(level ? { heading: HeadingLevel[`HEADING_${level[1]}`] } : {}) })];
  });
  const output = new Document({ sections: [{ children: blocks(root.body) }] });
  downloadKnowledgeBlob(await Packer.toBlob(output), `${name}.docx`);
}
