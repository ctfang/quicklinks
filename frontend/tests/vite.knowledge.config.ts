import path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../vite.config';

export default defineConfig(environment => mergeConfig(
  typeof baseConfig === 'function' ? baseConfig(environment) : baseConfig,
  { build: { rollupOptions: { input: { main: path.resolve(__dirname, '../index.html'), preview: path.resolve(__dirname, 'knowledge-preview.html') } } } },
));
