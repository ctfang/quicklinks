import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';
  return {
    plugins: [react(), tailwindcss(), {
      name: 'knowledge-canvas-fonts',
      generateBundle() {
        const root = path.resolve(__dirname, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
        const emitDirectory = (directory: string) => {
          for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) emitDirectory(file);
            else this.emitFile({ type: 'asset', fileName: `excalidraw-assets/fonts/${path.relative(root, file).split(path.sep).join('/')}`, source: fs.readFileSync(file) });
          }
        };
        emitDirectory(root);
      },
    }],
    build: {
      outDir: '../backend/dist',
      emptyOutDir: true,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      port: 4000,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
