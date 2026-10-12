const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function harness(icon = 'Link') {
  const states = [], saved = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    antd: { Alert: 'alert', Button: 'button', Card: 'card', Empty: 'empty', Input: 'input', Modal: 'modal', Segmented: 'segmented', Select: 'select', Switch: 'switch', Typography: { Paragraph: 'p', Text: 'span' } },
    'lucide-react': {},
    '../context/AppContext': { useAppContext: () => ({ user: { id: 1 } }) },
    '../lib/floatingNavigation': {
      useFloatingNavigation: () => [{ leftEnabled: true, left: [{ id: 'a', title: '示例', url: 'https://example.com/', icon }] }, async value => { saved.push(value); return true; }, '', false],
      normalizeFloatingUrl: value => new URL(value.trim()).href,
    },
    './LinkGrid': { NavIcon: 'nav-icon' },
  };
  const filename = path.resolve(__dirname, '../src/components/FloatingNavigationSettings.tsx');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name] }, { filename });
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = find(child, predicate);
      if (result) return result;
    }
  }
  return {
    saved,
    get(predicate) {
      cursor = 0;
      return find(module.exports.FloatingNavigationSettings(), predicate)?.props;
    },
  };
}

test('悬浮导航下拉项同时展示中文名称和图标', () => {
  const app = harness();
  app.get(node => node.props?.['aria-label'] === '编辑示例').onClick();
  const options = app.get(node => node.type === 'select').options;
  const globe = options.find(option => option.value === 'Globe');
  assert.equal(globe.label.props.children[1], '地球');
  assert.equal(globe.label.props.children[0].props.children.type, 'nav-icon');
  assert.equal(globe.label.props.children[0].props.children.props.name, 'Globe');
});

test('切换到图片 URL 可输入并保存自定义地址，再次编辑自动回填', async () => {
  const app = harness();
  app.get(node => node.props?.['aria-label'] === '编辑示例').onClick();
  app.get(node => node.type === 'segmented').onChange('url');
  const input = app.get(node => node.props?.id === 'floating-icon');
  assert.equal(input.type, 'url');
  input.onChange({ target: { value: 'https://cdn.example.com/custom.png' } });
  await app.get(node => node.type === 'form').onSubmit({ preventDefault() {} });
  assert.equal(app.saved[0].left[0].icon, 'https://cdn.example.com/custom.png');

  const existing = harness(app.saved[0].left[0].icon);
  existing.get(node => node.props?.['aria-label'] === '编辑示例').onClick();
  assert.equal(existing.get(node => node.type === 'segmented').value, 'url');
  assert.equal(existing.get(node => node.props?.id === 'floating-icon').value, app.saved[0].left[0].icon);
});

test('无效的自定义图片地址不会保存', async () => {
  const app = harness();
  app.get(node => node.props?.['aria-label'] === '编辑示例').onClick();
  app.get(node => node.type === 'segmented').onChange('url');
  app.get(node => node.props?.id === 'floating-icon').onChange({ target: { value: 'javascript:alert(1)' } });
  await app.get(node => node.type === 'form').onSubmit({ preventDefault() {} });
  assert.equal(app.saved.length, 0);
  assert.match(app.get(node => node.type === 'alert').title, /图片地址/);
});

test('自动识别和图片地址留空均向后台保存空图标', async () => {
  for (const mode of ['preset', 'url']) {
    const app = harness();
    app.get(node => node.props?.['aria-label'] === '编辑示例').onClick();
    if (mode === 'url') app.get(node => node.type === 'segmented').onChange('url');
    else app.get(node => node.type === 'select').onChange('');
    await app.get(node => node.type === 'form').onSubmit({ preventDefault() {} });
    assert.equal(app.saved[0].left[0].icon, '');
  }
});

test('本地图标可回填到下拉框，并按图片渲染', () => {
  const icon = `/static/icons/${'a'.repeat(64)}.png`;
  const app = harness(icon);
  app.get(node => node.props?.['aria-label'] === '编辑示例').onClick();
  assert.equal(app.get(node => node.type === 'select').value, icon);
  const filename = path.resolve(__dirname, '../src/components/LinkGrid.tsx');
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { memo: component => component, useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': {}, '../lib/utils': {}, '../lib/navigationCard': {},
  };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name] }, { filename });
  const image = module.exports.NavIcon({ name: icon, url: 'https://example.com', pixelSize: 28, strokeWidth: 1.7 });
  assert.equal(image.type, 'img');
  assert.equal(image.props.src, icon);
});

test('首页缺省布局使用链接设置，已有布局选择仍保留', () => {
  let stored = null;
  const filename = path.resolve(__dirname, '../src/lib/navigationAppearance.ts');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, URL,
    localStorage: { getItem: () => stored },
    require: () => ({ useState: initial => [initial, () => {}], useEffect: () => {} }),
  }, { filename });
  const read = () => module.exports.useNavigationAppearance('user_1')[0].layoutMode;
  assert.equal(read(), 'configured');
  for (const layoutMode of ['mixed', 'icons', 'configured']) {
    stored = JSON.stringify({ layoutMode });
    assert.equal(read(), layoutMode);
  }
  for (const value of ['{}', '{"layoutMode":"invalid"}', '{broken']) {
    stored = value;
    assert.equal(read(), 'configured');
  }
});
