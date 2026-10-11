import path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../vite.config';
export default defineConfig(environment => mergeConfig(
  typeof baseConfig === 'function' ? baseConfig(environment) : baseConfig,
  {
    plugins: [{ name: 'workspace-test-fixtures', enforce: 'pre', resolveId(source, importer) {
      if (source === '../context/AppContext') return path.resolve(__dirname, 'knowledge-workspace-context.ts');
      if (source === '../services/api' && importer?.replaceAll('\\', '/').endsWith('/pages/Wiki.tsx')) return path.resolve(__dirname, 'knowledge-workspace-api.ts');
    } }],
    build: { rollupOptions: { input: path.resolve(__dirname, 'knowledge-workspace.html') } },
  },
));
