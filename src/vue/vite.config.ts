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
    rollupOptions: {
      input: {
        about: resolve(__dirname, 'about/index.html'),
        home: resolve(__dirname, 'home/index.html'),
        projects: resolve(__dirname, 'projects/index.html'),
      },
      output: {
        manualChunks: undefined, // 避免生成太多chunk
      }
    },
    outDir: '../../out',
    assetsDir: 'assets',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    minify: 'terser', // 使用terser进行更好的压缩
    terserOptions: {
      compress: {
        drop_console: true, // 移除console.log
        drop_debugger: true, // 移除debugger
      },
    },
    cssCodeSplit: false, // 将CSS合并为单个文件
  }
});
