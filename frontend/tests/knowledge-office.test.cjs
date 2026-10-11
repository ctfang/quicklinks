const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const ExcelJS = require('exceljs');
const docx = require('docx');

const dom = new JSDOM();
const purifier = createDOMPurify(dom.window);
const downloads = [];
function load(file) {
  const filename = path.resolve(__dirname, '../src/lib', file);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Error, Blob, Uint8Array, ArrayBuffer, atob,
    DOMParser: dom.window.DOMParser, Node: dom.window.Node, Element: dom.window.Element,
    require: name => name === 'dompurify' ? { __esModule: true, default: purifier } : name === './knowledgeDocument' ? documentModule : name === 'mammoth' ? require('mammoth/mammoth.browser.js') : require(name),
  }, { filename });
  return module.exports;
}
const documentModule = load('knowledgeDocument.ts');
documentModule.downloadKnowledgeBlob = (blob, name) => downloads.push({ blob, name });
const { importKnowledgeFile, exportKnowledgeFile } = load('knowledgeOffice.ts');

test('XLSX 导入、编辑和导出保留多工作表、公式、合并单元格与中文', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('预算');
  sheet.getCell('A1').value = '项目预算';
  sheet.mergeCells('A1:B1');
  sheet.getCell('A2').value = 10;
  sheet.getCell('A2').font = { bold: true };
  sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
  sheet.getCell('B2').value = 20;
  sheet.getCell('C2').value = { formula: 'SUM(A2:B2)', result: 30 };
  workbook.addWorksheet('计划').getCell('A1').value = '第二页';
  const buffer = await workbook.xlsx.writeBuffer();
  const content = await importKnowledgeFile(new File([buffer], '预算.xlsx'));
  const document = documentModule.parseKnowledgeDocument(content);
  assert.equal(document.kind, 'sheet');
  assert.equal(document.sheets.length, 2);
  document.sheets[0].celldata.find(cell => cell.r === 1 && cell.c === 0).v.v = 15;
  await exportKnowledgeFile(documentModule.serializeKnowledgeDocument(document), '编辑后的预算');
  const output = downloads.pop();
  assert.equal(output.name, '编辑后的预算.xlsx');
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await output.blob.arrayBuffer());
  assert.equal(restored.worksheets[0].getCell('A2').value, 15);
  assert.equal(restored.worksheets[0].getCell('A2').font.bold, true);
  assert.equal(restored.worksheets[0].getCell('A2').fill.fgColor.argb, 'FFFF0000');
  assert.equal(restored.worksheets[0].getCell('C2').formula, 'SUM(A2:B2)');
  assert.equal(restored.worksheets[0].getCell('B1').isMerged, true);
  assert.equal(restored.worksheets[1].getCell('A1').value, '第二页');
});

test('DOCX 导入并编辑后可导出为可读取的 Word 文件', async () => {
  const source = new docx.Document({ sections: [{ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: '团队文档', bold: true })] })] }] });
  const buffer = await docx.Packer.toBuffer(source);
  const content = await importKnowledgeFile(new File([buffer], '团队.docx'));
  const document = documentModule.parseKnowledgeDocument(content);
  assert.equal(document.kind, 'word');
  assert.ok(document.html.includes('团队文档'));
  document.html += '<h1>在线修改</h1><table><tr><td><p>单元格内容</p></td></tr></table>';
  await exportKnowledgeFile(documentModule.serializeKnowledgeDocument(document), '更新团队文档');
  const output = downloads.pop();
  const mammoth = require('mammoth/mammoth.browser.js');
  const restored = await mammoth.convertToHtml({ arrayBuffer: await output.blob.arrayBuffer() });
  assert.ok(restored.value.includes('团队文档'));
  assert.ok(restored.value.includes('<h1>在线修改</h1>'));
  assert.ok(restored.value.includes('单元格内容'));
});

test('导入拒绝超限文件与损坏的画布', async () => {
  await assert.rejects(importKnowledgeFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], '大文件.txt')), /2 MB/);
  await assert.rejects(importKnowledgeFile(new File(['{"type":"other","elements":[]}'], '错误.excalidraw')), /无效/);
});
