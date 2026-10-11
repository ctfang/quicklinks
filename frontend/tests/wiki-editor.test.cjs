const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function harness({ newKind, initialNodes = [], loadDocument, compact = false } = {}) {
  const states = [], dependencies = [], effects = [], saves = [], creations = [], requests = [], documentRequests = [];
  let params = new URLSearchParams(newKind ? { new: newKind } : {});
  let cursor = 0, rejectSave = false;
  const react = {
    createElement: (type, props) => ({ type, props }),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) effects.push(callback);
      dependencies[index] = deps;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-router-dom': { useParams: () => ({ id: 'team-a' }), useSearchParams: () => [params, next => { params = next; }] },
    '../context/AppContext': { useAppContext: () => ({ teams: [{ id: 'team-a', name: '团队 A' }] }) },
    '../services/api': {
      getTeamWikiNodes: async teamId => { requests.push(teamId); return initialNodes.map(({ content, ...node }) => node); },
      getWikiNode: async id => { documentRequests.push(id); return loadDocument ? loadDocument(id, documentRequests.length) : initialNodes.find(node => node.id === id); },
      createWikiNode: async (teamId, parentId, type, title) => { const node = { id: 'doc', teamId, parentId, type, title, content: '# 新文档' }; creations.push(node); return node; },
      updateWikiNode: async (id, updates) => {
        saves.push({ id, ...updates });
        if (rejectSave) throw new Error('保存失败');
        return { ...creations.find(node => node.id === id), ...updates };
      },
    },
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    '../components/KnowledgeDocumentView': { KnowledgeDocumentView: 'document-view' },
    '../lib/knowledgeDocument': {
      createKnowledgeDocument: kind => `文档初始化:${kind}`,
      parseKnowledgeDocument: () => ({ kind: 'markdown' }),
      knowledgeSearchText: content => content,
      documentLabels: { markdown: 'Markdown', word: 'Word 文档', sheet: 'Excel 表格', canvas: '自由画布' },
      documentContentLimit: 3 * 1024 * 1024,
    },
    '../lib/knowledgeOffice': { importKnowledgeFile: async () => '# 导入文件' },
    '../lib/utils': { cn: (...values) => values.join(' ') },
    '../components/ConfirmModal': { ConfirmModal: 'modal' },
    antd: { Alert: 'alert', Button: 'button', Drawer: 'drawer', Dropdown: 'dropdown', Upload: Object.assign(function Upload() {}, { Dragger: 'dragger' }), Empty: 'empty', Spin: 'spin', Select: 'select', Modal: 'create-modal', Tree: 'tree', Input: Object.assign(function Input() {}, { Search: 'search' }) },
  };
  const filename = path.resolve(__dirname, '../src/pages/Wiki.tsx');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, Error, Blob, URLSearchParams, window: { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: compact, addEventListener() {}, removeEventListener() {} }) }, require: name => mocks[name] }, { filename });
  function render() {
    cursor = 0;
    const tree = module.exports.Wiki();
    effects.splice(0).forEach(effect => effect());
    return tree;
  }
  function find(predicate, tree = render()) {
    if (!tree || typeof tree !== 'object') return;
    if (Array.isArray(tree)) return tree.map(node => find(predicate, node)).find(Boolean);
    if (predicate(tree)) return tree;
    return tree.props?.children === undefined ? undefined : find(predicate, tree.props.children);
  }
  return { render, find, saves, creations, requests, documentRequests, rejectSave: value => { rejectSave = value; } };
}

test('文件夹的新建入口可选择 Excel，保存后保留所在目录', async () => {
  const app = harness({ initialNodes: [{ id: 'folder-a', parentId: null, type: 'folder', title: '项目资料' }] });
  app.render();
  await new Promise(resolve => setImmediate(resolve));
  const folder = app.find(node => node.type === 'tree').props.treeData[0];
  folder.title.props.menu.onClick({ key: 'sheet' });
  app.find(node => node.type === 'button' && node.props.children?.includes?.('Excel 表格')).props.onClick();
  app.find(node => node.props?.['aria-label'] === '文档名称').props.onChange({ target: { value: '预算表' } });
  await app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(app.creations[0].parentId, 'folder-a');
  assert.equal(app.saves[0].content, '文档初始化:sheet');
  assert.equal(app.find(node => node.type === 'document-view').props.editing, true);
});

test('小屏目录默认收起，未保存草稿取消切换后保留编辑器和打开的目录', async () => {
  const app = harness({ compact: true, initialNodes: [
    { id: 'a', teamId: 'team-a', parentId: null, type: 'document', title: '文档 A', content: '# A' },
    { id: 'b', teamId: 'team-a', parentId: null, type: 'document', title: '文档 B', content: '# B' },
  ] });
  app.render();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.find(node => node.type === 'drawer').props.open, false);
  app.find(node => node.type === 'button' && node.props.children === '打开目录').props.onClick();
  assert.equal(app.find(node => node.type === 'drawer').props.open, true);
  app.find(node => node.type === 'tree').props.onSelect([], { node: { key: 'a' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.find(node => node.type === 'drawer').props.open, false);
  app.find(node => node.type === 'button' && node.props.children?.some?.(child => typeof child === 'string' && child.trim() === '编辑')).props.onClick();
  app.find(node => node.type === 'document-view').props.onChange('# 未保存草稿');
  app.find(node => node.props?.['aria-label'] === '打开知识库目录').props.onClick();
  app.find(node => node.type === 'tree').props.onSelect([], { node: { key: 'b' } });
  const confirm = app.find(node => node.type === 'modal');
  assert.equal(confirm.props.isOpen, true);
  confirm.props.onClose();
  assert.equal(app.find(node => node.type === 'drawer').props.open, true);
  assert.equal(app.find(node => node.type === 'document-view').props.value, '# 未保存草稿');
  assert.deepEqual(app.documentRequests, ['a']);
});

async function createDocument(app) {
  app.render();
  await new Promise(resolve => setImmediate(resolve));
  app.find(node => node.type === 'dropdown').props.menu.onClick({ key: 'word' });
  app.find(node => node.type === 'button' && node.props.children?.includes?.('Markdown')).props.onClick();
  app.find(node => node.props?.['aria-label'] === '文档名称').props.onChange({ target: { value: '新文档' } });
  await app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  app.render();
}

test('新建文档进入编辑，草稿预览后仍可保存且内容完整', async () => {
  const app = harness();
  await createDocument(app);
  assert.equal(app.find(node => node.type === 'document-view').props.value, '# 新文档');
  app.find(node => node.type === 'document-view').props.onChange('# 未保存草稿');
  app.find(node => node.type === 'button' && node.props.children?.includes?.('预览')).props.onClick();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '# 未保存草稿');
  assert.equal(app.find(node => node.type === 'document-view').props.preview, true);
  const save = app.find(node => node.type === 'button' && node.props.children?.includes?.('保存'));
  await save.props.onClick();
  assert.equal(app.saves[0].content, '# 未保存草稿');
  assert.equal(app.find(node => node.type === 'document-view').props.value, '# 未保存草稿');
  assert.equal(app.find(node => node.type === 'document-view').props.editing, false);
});

test('保存失败显示错误、保留草稿并允许重试', async () => {
  const app = harness();
  await createDocument(app);
  app.find(node => node.type === 'document-view').props.onChange('需要保留的草稿');
  app.rejectSave(true);
  await app.find(node => node.type === 'button' && node.props.children?.includes?.('保存')).props.onClick();
  assert.equal(app.find(node => node.type === 'alert').props.title, '保存失败');
  assert.equal(app.find(node => node.type === 'document-view').props.value, '需要保留的草稿');
  const save = app.find(node => node.type === 'button' && node.props.children?.includes?.('保存'));
  assert.equal(save.props.loading, false);
  app.rejectSave(false);
  await save.props.onClick();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '需要保留的草稿');
});

test('新建其他文档前提醒未保存内容，取消时保留原草稿', async () => {
  const app = harness();
  await createDocument(app);
  app.find(node => node.type === 'document-view').props.onChange('未保存的内容');
  app.find(node => node.type === 'dropdown').props.menu.onClick({ key: 'word' });
  const modal = app.find(node => node.type === 'modal');
  assert.equal(modal.props.isOpen, true);
  assert.equal(modal.props.isDestructive, false);
  modal.props.onClose();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '未保存的内容');
  assert.equal(app.find(node => node.type === 'document-view').props.editing, true);
});

test('首页指定自由画布时打开命名表单，并按画布类型初始化内容', async () => {
  const app = harness({ newKind: 'canvas' });
  app.render();
  await new Promise(resolve => setImmediate(resolve));
  app.render();
  app.find(node => node.props?.['aria-label'] === '文档名称').props.onChange({ target: { value: '流程画布' } });
  await app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(app.saves[0].content, '文档初始化:canvas');
  assert.equal(app.find(node => node.type === 'document-view').props.editing, true);
});

for (const [kind, label] of [['word', 'Word 文档'], ['sheet', 'Excel 表格'], ['canvas', '自由画布']]) {
  test(`团队内新建文件可以选择 ${label} 并打开对应编辑器`, async () => {
    const app = harness();
    app.render();
    await new Promise(resolve => setImmediate(resolve));
    app.find(node => node.type === 'dropdown').props.menu.onClick({ key: 'word' });
    app.find(node => node.type === 'button' && node.props.children?.includes?.(label)).props.onClick();
    assert.equal(app.find(node => node.type === 'button' && node.props.children?.includes?.(label)).props['aria-pressed'], true);
    app.find(node => node.props?.['aria-label'] === '文档名称').props.onChange({ target: { value: label } });
    await app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(app.saves[0].content, `文档初始化:${kind}`);
    assert.equal(app.find(node => node.type === 'document-view').props.value, `文档初始化:${kind}`);
    assert.equal(app.find(node => node.type === 'document-view').props.editing, true);
  });
}

test('右键根目录创建文件夹使用根目录，不跟随当前选中的目录', async () => {
  const app = harness({ initialNodes: [{ id: 'folder-a', parentId: null, type: 'folder', title: '项目资料' }] });
  app.render();
  await new Promise(resolve => setImmediate(resolve));
  app.find(node => node.type === 'tree').props.onSelect([], { node: { key: 'folder-a' } });
  app.find(node => node.type === 'dropdown').props.menu.onClick({ key: 'folder' });
  app.find(node => node.props?.['aria-label'] === '文件夹名称').props.onChange({ target: { value: '根目录文件夹' } });
  await app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(app.creations[0].parentId, null);
  assert.equal(app.creations[0].type, 'folder');
});

test('右键目标目录导入文件，保持右键目录而非当前选中目录', async () => {
  const app = harness({ initialNodes: [{ id: 'folder-a', parentId: null, type: 'folder', title: '项目资料' }] });
  app.render();
  await new Promise(resolve => setImmediate(resolve));
  app.find(node => node.type === 'tree').props.treeData[0].title.props.menu.onClick({ key: 'import' });
  app.find(node => node.type === 'dragger').props.beforeUpload({ name: '说明.md' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.creations[0].parentId, 'folder-a');
  assert.equal(app.saves[0].content, '# 导入文件');
});

const documentNode = (id, content) => ({ id, teamId: 'team-a', parentId: null, type: 'document', title: id, content });
const flush = () => new Promise(resolve => setImmediate(resolve));
const selectNode = (app, key) => app.find(node => node.type === 'tree').props.onSelect([], { node: { key } });

test('打开与切换文档均请求服务器，显示最新内容而非首次加载的快照', async () => {
  const original = [documentNode('a', '旧 A'), documentNode('b', '旧 B')];
  const app = harness({ initialNodes: original, loadDocument: id => documentNode(id, `最新 ${id}`) });
  app.render();
  await flush();
  selectNode(app, 'a');
  assert.equal(app.find(node => node.type === 'document-view'), undefined);
  await flush();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '最新 a');
  selectNode(app, 'b');
  await flush();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '最新 b');
  assert.equal(app.requests.length, 1);
  assert.deepEqual(app.documentRequests, ['a', 'b']);
});

test('快速切换文档时，先前请求的迟到结果不会覆盖当前文档', async () => {
  const original = [documentNode('a', '旧 A'), documentNode('b', '旧 B')];
  let resolveFirst, resolveSecond;
  const app = harness({ initialNodes: original, loadDocument: (id, count) => new Promise(resolve => { if (count === 1) resolveFirst = resolve; else resolveSecond = resolve; }) });
  app.render();
  await flush();
  selectNode(app, 'a');
  selectNode(app, 'b');
  resolveSecond(documentNode('b', '新 b'));
  await flush();
  resolveFirst(documentNode('a', '旧 A'));
  await flush();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '新 b');
});

test('文档刷新失败时隐藏旧内容，允许重新加载', async () => {
  const original = [documentNode('a', '旧 A')];
  const app = harness({ initialNodes: original, loadDocument: (id, count) => { if (count === 1) throw new Error('网络失败'); return documentNode(id, '最新 A'); } });
  app.render();
  await flush();
  selectNode(app, 'a');
  await flush();
  assert.equal(app.find(node => node.type === 'alert').props.title, '网络失败');
  assert.equal(app.find(node => node.type === 'document-view'), undefined);
  app.find(node => node.type === 'button' && node.props.children === '重新加载').props.onClick();
  await flush();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '最新 A');
});

test('切换文档前先确认未保存草稿，取消不发起刷新也不丢失草稿', async () => {
  const app = harness({ initialNodes: [documentNode('other', '其他文档')] });
  await createDocument(app);
  app.find(node => node.type === 'document-view').props.onChange('未保存草稿');
  selectNode(app, 'other');
  const modal = app.find(node => node.type === 'modal');
  assert.equal(modal.props.isOpen, true);
  assert.equal(app.requests.length, 1);
  assert.equal(app.documentRequests.length, 0);
  modal.props.onClose();
  assert.equal(app.find(node => node.type === 'document-view').props.value, '未保存草稿');
});
