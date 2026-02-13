import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: '/digdug/',
    build: {
        outDir: 'dist-demo',
        emptyOutDir: true,
        sourcemap: false,
        minify: 'terser',
        assetsInlineLimit: 100000,
        rollupOptions: {
            input: resolve(import.meta.dirname, 'demo/index.html'),
        },
    },
});
