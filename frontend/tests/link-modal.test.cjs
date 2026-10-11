const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function harness() {
  const states = [], effects = [], dependencies = [], saved = [];
  let cursor = 0;
  const react = {
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], next => { states[index] = next; }];
    },
    useEffect: (effect, deps) => {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) effects.push(effect);
      dependencies[index] = deps;
    },
  };
  function load(file, mocks) {
    const module = { exports: {} };
    const filename = path.resolve(__dirname, '../src', file);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name], console }, { filename });
    return module.exports;
  }
  const jsx = (type, props) => ({ type, props });
  const { LinkModal } = load('components/LinkModal.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    antd: { Typography: { Paragraph: 'paragraph' }, Select: 'select', Modal: 'modal', Input: 'input', Button: 'button', Segmented: 'segmented' },
    'lucide-react': {},
    '../lib/navigationCard': load('lib/navigationCard.ts', {}),
  });
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  return {
    saved,
    render: props => {
      const input = { isOpen: true, onClose: () => {}, onSave: async payload => { saved.push(payload); }, ...props };
      cursor = 0;
      let tree = LinkModal(input);
      if (effects.length) {
        effects.splice(0).forEach(effect => effect());
        cursor = 0;
        tree = LinkModal(input);
      }
      return { size: find(tree, node => node.props?.['aria-label'] === '卡片尺寸').props, submit: () => find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} }) };
    },
  };
}

test('编辑尺寸回填当前显示值，未修改尺寸时不覆盖原始配置', async () => {
  const app = harness();
  const props = { initialData: { id: 'a', title: 'A', url: 'https://example.com', displaySize: 'medium' }, initialDisplaySize: 'large' };
  assert.equal(app.render(props).size.value, 'large');
  await app.render(props).submit();
  assert.equal('displaySize' in app.saved[0], false);
  app.render(props).size.onChange('small');
  await app.render(props).submit();
  assert.equal(app.saved[1].displaySize, 'small');
});

test('切换编辑卡片时重新选中对应尺寸，新增仍默认极简图标', () => {
  const app = harness();
  for (const size of ['icon', 'small', 'medium', 'large', 'list']) {
    assert.equal(app.render({ initialData: { id: size, title: size, url: 'https://example.com', displaySize: size } }).size.value, size);
  }
  assert.equal(app.render({ initialData: { id: 'legacy', title: '旧卡片', url: 'https://example.com', displaySize: 'invalid' } }).size.value, 'medium');
  assert.equal(app.render({}).size.value, 'icon');
});
