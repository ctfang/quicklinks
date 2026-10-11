const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

async function harness(layoutMode, fail = false, team = null) {
  const states = [], effects = [], calls = [];
  let cursor = 0, mounted = false;
  let appearance = { layoutMode, style: 'light', background: 'plain', theme: 'aurora', cardMode: 'mixed' };
  const link = { id: 'a', title: 'A', url: 'https://example.com', displaySize: 'medium' };
  const jsx = (type, props) => ({ type, props });
  const api = {
    getPersonalLinksWithCache: async () => [link], getTeamLinksWithCache: async () => [link],
    getGroupsWithCache: async () => [], getTeamProjectsWithCache: async () => [],
    updateLinkWithCache: async (id, data, context) => {
      calls.push({ id, data, context });
      if (fail) throw new Error('保存失败');
      return { ...link, ...data };
    },
  };
  const mocks = {
    react: {
      useState: initial => {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
      },
      useEffect: effect => { if (!mounted) effects.push(effect); },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../context/AppContext': { useAppContext: () => ({ user: { id: 'u' }, currentTeam: team }) },
    '../services/api': api,
    '../lib/navigationAppearance': { useNavigationAppearance: scope => [appearance, next => { appearance = next; calls.push({ scope, appearance }); }] },
    '../lib/floatingNavigation': { useFloatingNavigation: () => [{}] },
    '../lib/recentNavigation': { useRecentNavigation: () => [[], () => {}] },
    './LinkGrid': { LinkGrid: 'grid' }, './LinkModal': { LinkModal: 'modal' },
  };
  const filename = path.resolve(__dirname, '../src/components/NavigationContent.tsx');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name] || {} }, { filename });
  function find(node, type) {
    if (!node || typeof node !== 'object') return;
    if (node.type === type) return node.props;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, type);
      if (found) return found;
    }
  }
  function render() {
    cursor = 0;
    return module.exports.NavigationContent({ management: true });
  }
  render();
  mounted = true;
  effects.splice(0).forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  find(render(), 'grid').onEdit(link, 'medium');
  return { calls, save: data => find(render(), 'modal').onSave(data), appearance: () => appearance, grid: () => find(render(), 'grid') };
}

test('保存小尺寸后个人与团队自动使用配置布局，重新显示仍为小尺寸', async () => {
  for (const team of [null, { id: 't' }]) {
    for (const layout of ['mixed', 'icons']) {
      const app = await harness(layout, false, team);
      await app.save({ displaySize: 'small' });
      assert.equal(app.appearance().layoutMode, 'configured');
      assert.equal(app.grid().layoutMode, 'configured');
      assert.equal(app.grid().links[0].displaySize, 'small');
      assert.equal(app.calls[1].scope, team ? 'team_t' : 'user_u');
    }
  }
});

test('只编辑标题或保存图标尺寸时保留大小错落布局', async () => {
  for (const data of [{ title: '新标题' }, { displaySize: 'icon' }]) {
    const app = await harness('mixed');
    await app.save(data);
    assert.equal(app.appearance().layoutMode, 'mixed');
  }
});

test('保存失败不改变布局或原卡片尺寸', async () => {
  const app = await harness('mixed', true);
  await assert.rejects(app.save({ displaySize: 'small' }), /保存失败/);
  assert.equal(app.appearance().layoutMode, 'mixed');
  assert.equal(app.grid().links[0].displaySize, 'medium');
});
