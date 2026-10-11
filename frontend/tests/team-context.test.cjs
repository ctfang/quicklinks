const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// 在内存中运行真实 Provider，验证团队状态与缓存，不创建数据库测试账号或团队。
function harness() {
  const states = [];
  let cursor = 0;
  let cachedTeams = [];
  let serverTeams = [{ id: 'existing', name: '已有团队' }];
  const requests = [];
  const storage = new Map();
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useCallback: callback => callback,
    useEffect: () => {},
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../services/api': {
      getUserTeamsWithCache: async (id, options) => {
        requests.push(options);
        return options.useCache === false ? serverTeams : cachedTeams;
      },
      getGuestNavigation: async () => ({ userId: 1 }),
    },
    '../lib/dataCache': { cacheCurrentUser: () => {}, cacheTeams: (_, teams) => { cachedTeams = teams; } },
    '../lib/weatherLocation': { DEFAULT_WEATHER_LOCATION: { province: '广东', city: '深圳' }, readWeatherLocationFromStorage: () => ({ province: '广东', city: '深圳' }) },
    '../lib/searchEngine': { DEFAULT_SEARCH_ENGINE: { id: 'baidu', name: '百度' }, readSearchEngineFromStorage: () => ({ id: 'baidu', name: '百度' }) },
  };
  const filename = path.resolve(__dirname, '../src/context/AppContext.tsx');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, require: name => mocks[name], window: {},
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  }, { filename });
  return {
    render: () => { cursor = 0; return module.exports.AppProvider({ children: null }).props.value; },
    cache: () => cachedTeams,
    requests,
    setServerTeams: teams => { serverTeams = teams; },
  };
}

test('恢复会话时从服务器获取团队，不把旧的空缓存当成最终列表', async () => {
  const app = harness();
  await app.render().loginUser({ id: 2 });
  assert.equal(app.requests[0].useCache, false);
  assert.equal(app.render().teams[0].id, 'existing');
});

test('创建结果立即进入团队列表及缓存，不切换全局加载状态', async () => {
  const app = harness();
  await app.render().loginUser({ id: 2 });
  app.render().saveTeam({ id: 'created', name: '新团队' });
  assert.equal(app.render().teams.length, 2);
  assert.equal(app.cache()[1].id, 'created');
  assert.equal(app.render().isLoading, false);
});

test('更新团队后同步当前空间，删除当前团队后回到个人空间', async () => {
  const app = harness();
  await app.render().loginUser({ id: 2 });
  app.render().setCurrentTeam(app.render().teams[0]);
  app.render().saveTeam({ id: 'existing', name: '更新名称' });
  assert.equal(app.render().currentTeam.name, '更新名称');
  app.setServerTeams([]);
  await app.render().refreshTeams();
  assert.equal(app.render().currentTeam, null);
  assert.equal(app.render().teams.length, 0);
});
