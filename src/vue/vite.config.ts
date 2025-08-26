import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  build: {
    sourcemap: true, // 启用源映射以支持调试
    rollupOptions: {
      input: {
        about: resolve(__dirname, 'about/index.html'),
        setting: resolve(__dirname, 'setting/index.html'),
        projects: resolve(__dirname, 'projects/index.html'),
        'create-project': resolve(__dirname, 'create-project/index.html'),
      },
      output: {
        manualChunks: undefined, // 避免生成太多chunk
        sourcemapExcludeSources: false, // 在源映射中包含源代码
      }
    },
    outDir: '../../out',
    assetsDir: 'assets',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    minify: false, // 开发时不压缩
    terserOptions: {
      compress: {
        drop_console: false, // 不移除console.log
        drop_debugger: true, // 移除debugger
      },
    },
    cssCodeSplit: false, // 将CSS合并为单个文件
  }
});
