const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/knowledgeDocument.ts');
const moduleExports = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(source, { module: moduleExports, exports: moduleExports.exports, Error });
const { parseKnowledgeDocument: parse, serializeKnowledgeDocument: serialize, createKnowledgeDocument: create, knowledgeSearchText: search } = moduleExports.exports;

test('原有 Markdown 内容保持原样，不被误判为结构化文档', () => {
  for (const content of ['# 原有文档\n正文', '{"kind":"word","html":"旧代码示例"}', '']) {
    assert.equal(parse(content).kind, 'markdown');
    assert.equal(serialize(parse(content)), content);
  }
});

test('Word、Excel 和画布序列化后可完整恢复', () => {
  for (const kind of ['word', 'sheet', 'canvas']) {
    const content = create(kind);
    assert.equal(parse(content).kind, kind);
    assert.equal(serialize(parse(content)), content);
  }
  const scene = { elements: [{ id: 'image', type: 'image', fileId: 'asset' }], appState: { viewBackgroundColor: '#fff' }, files: { asset: { dataURL: 'data:image/png;base64,YQ==' } } };
  const restored = parse(serialize({ kind: 'canvas', scene }));
  assert.equal(JSON.stringify(restored.scene), JSON.stringify(scene));
});

test('文件数据拒绝可执行格式，损坏的结构化文档不能静默覆盖', () => {
  assert.throws(() => parse('quicklinks-document:v1\n{"kind":"word"}'));
  assert.throws(() => parse('quicklinks-document:v1\n{"kind":"file","name":"x.html","data":"data:text/html;base64,YQ=="}'));
  assert.throws(() => parse('quicklinks-document:v1\n{"kind":"file","name":"x.pdf","mime":"text/html","data":"data:application/pdf;base64,YQ=="}'));
  assert.throws(() => parse('quicklinks-document:v1\n{broken'));
});

test('按文档内容搜索富文本、工作表和画布文字', () => {
  assert.ok(search(serialize({ kind: 'word', html: '<h1>项目计划</h1>' })).includes('项目计划'));
  assert.ok(search(serialize({ kind: 'sheet', sheets: [{ name: '预算', celldata: [{ r: 0, c: 0, v: { v: '项目支出' } }] }] })).includes('项目支出'));
  assert.ok(search(serialize({ kind: 'canvas', scene: { elements: [{ text: '架构图' }], appState: {}, files: {} } })).includes('架构图'));
});
