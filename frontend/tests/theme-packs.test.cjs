const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name], URL, ...globals }, { filename });
  return module.exports;
}

test('套装按空间保存，恢复自由搭配保留原有壁纸、风格和尺寸模式', () => {
  const data = new Map([
    ['navihub_appearance_user_1', JSON.stringify({ themePack: 'custom', style: 'glass', background: 'landscape', theme: 'ocean', layoutMode: 'configured' })],
    ['navihub_appearance_team_a', JSON.stringify({ themePack: 'desert', background: 'plain', layoutMode: 'icons' })],
  ]);
  const { useNavigationAppearance, getThemePack } = load('lib/navigationAppearance.ts', {
    react: { useState: initial => [initial, () => {}], useEffect: () => {} },
  }, {
    localStorage: { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) },
    window: { dispatchEvent() {} }, CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  });
  const read = () => useNavigationAppearance('user_1');
  assert.equal(read()[0].themePack, 'custom');
  for (const themePack of ['yin-yang', 'woodland', 'rain', 'day-ink', 'winter', 'desert']) {
    const [appearance, save] = read();
    save({ ...appearance, themePack });
    assert.equal(read()[0].themePack, themePack);
    assert.ok(getThemePack(themePack).accent);
    assert.equal(read()[0].background, 'landscape');
    assert.equal(read()[0].style, 'glass');
    assert.equal(read()[0].layoutMode, 'configured');
    assert.equal(useNavigationAppearance('team_a')[0].themePack, 'desert');
    assert.equal(useNavigationAppearance('team_a')[0].layoutMode, 'icons');
  }
  read()[1]({ ...read()[0], themePack: 'custom' });
  assert.equal(read()[0].themePack, 'custom');
  assert.equal(read()[0].theme, 'ocean');
  data.set('navihub_appearance_user_1', '{"themePack":"invalid","background":"landscape"}');
  assert.equal(read()[0].themePack, 'yin-yang');
  assert.equal(read()[0].background, 'landscape');
  data.delete('navihub_appearance_user_1');
  assert.equal(read()[0].themePack, 'yin-yang');
  data.set('navihub_appearance_user_1', '{"themePack":"autumn","layoutMode":"icons"}');
  assert.equal(read()[0].themePack, 'day-ink');
  assert.equal(read()[0].layoutMode, 'icons');
  for (const background of ['yin-yang', 'woodland']) {
    for (const themePack of [undefined, 'custom']) {
      data.set('navihub_appearance_user_1', JSON.stringify({ background, themePack }));
      assert.equal(read()[0].themePack, background);
      assert.equal(read()[0].background, 'gradient');
    }
  }
});

test('套装渲染将自定义链接颜色用作点缀，原始链接数据保持完整', () => {
  const jsx = (type, props) => ({ type, props });
  const { NavigationLinkCard } = load('components/LinkGrid.tsx', {
    react: { memo: component => component }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': {}, '../lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') }, '../lib/navigationCard': {},
  });
  const link = Object.freeze({ id: 'a', title: 'Example', url: 'https://example.com', icon: 'Globe', bgColor: '#ff8800', displaySize: 'small' });
  const themed = NavigationLinkCard({ link, size: 'small', themed: true, inkScene: 'landscape' });
  assert.equal(themed.props.style.background, undefined);
  assert.equal(themed.props.style['--link-tint'], '#ff8800');
  assert.equal(themed.props.href, link.url);
  assert.equal(themed.props['data-card-size'], 'small');
  assert.equal(themed.props['data-ink-scene'], 'landscape');
  const custom = NavigationLinkCard({ link, size: 'small' });
  assert.equal(custom.props.style.background, '#ff8800');
  assert.equal(link.bgColor, '#ff8800');
});

test('水墨卡片按实际导航顺序跨分组轮换，其他主题不分配水墨图案', () => {
  const jsx = (type, props) => ({ type, props });
  const ink = load('lib/navigationInk.ts', {});
  const { NavigationLibrary } = load('components/NavigationLibrary.tsx', {
    react: { useState: initial => [initial, () => {}], useEffect() {}, useRef: () => ({ current: null }), useMemo: fn => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': {},
    '../lib/navigationCard': { navigationCardSize: () => 'small' }, '../lib/navigationInk': ink,
    '../lib/searchEngine': {}, '../context/AppContext': { useAppContext: () => ({ searchEngine: { name: '百度' }, weatherLocation: { city: '深圳' } }) },
    './LinkGrid': { NavigationLinkCard: 'ink-card' }, './Widgets': { ClockWidget: 'clock', WeatherWidget: 'weather' }, './WeatherLocationModal': { WeatherLocationModal: 'modal' },
  });
  const links = Array.from({ length: 10 }, (_, index) => ({ id: String(index), title: String(index), url: 'https://example.com', groupId: index < 4 ? 'a' : 'b', order: index }));
  const props = { links: [...links].reverse(), groups: [{ id: 'a', name: 'A', order: 0 }, { id: 'b', name: 'B', order: 1 }], projects: [], loading: false, error: '' };
  function cards(node) {
    if (!node || typeof node !== 'object') return [];
    if (node.type === 'ink-card') return [node.props];
    return [node.props?.children].flat(Infinity).flatMap(cards);
  }
  const result = cards(NavigationLibrary({ ...props, appearance: { themePack: 'yin-yang', layoutMode: 'configured' } }));
  assert.deepEqual(result.map(card => card.link.id), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  assert.deepEqual(result.map(card => card.inkScene), ['landscape', 'fish', 'shrimp', 'splash', 'ripples', 'trees', 'grasses', 'lotus', 'river', 'landscape']);
  const other = cards(NavigationLibrary({ ...props, appearance: { themePack: 'rain', layoutMode: 'configured' } }));
  assert.ok(other.every(card => card.inkScene === undefined));
  const day = cards(NavigationLibrary({ ...props, appearance: { themePack: 'day-ink', layoutMode: 'configured' } }));
  assert.deepEqual(day.slice(0, 7).map(card => card.inkScene), ['landscape', 'fish-shrimp', 'trees', 'grasses', 'lotus', 'river', 'landscape']);
});
