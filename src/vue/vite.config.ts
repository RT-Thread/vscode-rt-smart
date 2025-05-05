import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        about: resolve(__dirname, 'about/index.html'),
        home: resolve(__dirname, 'home/index.html'),
        projects: resolve(__dirname, 'projects/index.html'),
      }
    },
    outDir: '../../out',
    assetsDir: 'assets',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000
  }
})
