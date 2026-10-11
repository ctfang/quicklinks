const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const modules = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '../src/lib', file);
  if (modules.has(filename)) return modules.get(filename);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, URL,
    require: name => name.startsWith('.') ? load(`${name}.ts`) : require(name),
  }, { filename });
  modules.set(filename, module.exports);
  return module.exports;
}

const { parseFloatingNavigation } = load('floatingNavigation.ts');
const { parseRecentNavigation, updateRecentNavigation, readRecentNavigation, recentNavigationKey } = load('recentNavigation.ts');
const link = index => ({ id: String(index), title: `网站 ${index}`, url: `https://site${index}.example/`, icon: 'Globe' });

test('旧版右侧开关与手动链接不进入悬浮导航设置', () => {
  const config = parseFloatingNavigation(JSON.stringify({ leftEnabled: false, left: [link(1)], rightEnabled: false, right: [link(2)] }));
  assert.equal(config.leftEnabled, false);
  assert.equal(config.left[0].url, link(1).url);
  assert.equal('right' in config, false);
  assert.equal('rightEnabled' in config, false);
});

test('最近列表按网址去重，重访旧网站移到首位并保持最多八项', () => {
  let recent = [];
  for (let index = 0; index < 12; index++) recent = updateRecentNavigation(recent, link(index));
  recent = updateRecentNavigation(recent, link(5));
  assert.equal(recent.length, 8);
  assert.equal(recent[0].url, link(5).url);
  assert.equal(recent.filter(item => item.url === link(5).url).length, 1);
});

test('重复点击首项保持列表引用，避免无变化时重绘', () => {
  const recent = updateRecentNavigation([], link(1));
  assert.equal(updateRecentNavigation(recent, link(1)), recent);
});

test('加载历史记录时忽略损坏内容、危险网址及重复网址', () => {
  const recent = parseRecentNavigation(JSON.stringify([null, link(1), link(1), { ...link(2), url: 'javascript:alert(1)' }, link(3)]));
  assert.equal(recent.length, 2);
  assert.equal(recent[0].url, link(1).url);
  assert.equal(recent[1].url, link(3).url);
  assert.equal(parseRecentNavigation('{invalid').length, 0);
});

function recentStorage(entries) {
  const data = new Map(entries);
  return {
    get length() { return data.size; },
    key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('访客、个人和不同团队的旧点击记录合并到同一浏览器列表并按网址去重', () => {
  const storage = recentStorage([
    ['navihub_recent_guest', JSON.stringify([link(1)])],
    ['navihub_recent_user_1', JSON.stringify([link(2), link(1)])],
    ['navihub_recent_team_a', JSON.stringify([link(3)])],
    ['navihub_recent_team_b', JSON.stringify([link(4)])],
    ['navihub_appearance_user_1', JSON.stringify([link(5)])],
  ]);
  const recent = readRecentNavigation(storage);
  assert.deepEqual(Array.from(recent, item => item.url), [1, 2, 3, 4].map(index => link(index).url));
  assert.deepEqual(JSON.parse(storage.getItem(recentNavigationKey)), JSON.parse(JSON.stringify(recent)));
  assert.equal(storage.getItem('navihub_recent_user_1'), JSON.stringify([link(2), link(1)]));
});

test('共用记录存在后不再重新混入旧账号或团队列表，空列表也保持为空', () => {
  const storage = recentStorage([
    [recentNavigationKey, JSON.stringify([link(7)])],
    ['navihub_recent_team_a', JSON.stringify([link(1)])],
  ]);
  assert.equal(readRecentNavigation(storage)[0].url, link(7).url);
  storage.setItem(recentNavigationKey, '[]');
  assert.equal(readRecentNavigation(storage).length, 0);
});

test('迁移忽略损坏记录并保持最多八项', () => {
  const storage = recentStorage([
    ['navihub_recent_user_1', '{invalid'],
    ['navihub_recent_team_a', JSON.stringify(Array.from({ length: 8 }, (_, index) => link(index)))],
    ['navihub_recent_guest', JSON.stringify([link(9)])],
  ]);
  const recent = readRecentNavigation(storage);
  assert.equal(recent.length, 8);
  assert.equal(recent[0].url, link(0).url);
});
