import { defineConfig } from 'vite';

export default defineConfig({
    root: 'demo',
    base: '/digdug/',
    build: {
        outDir: '../dist-demo',
        emptyOutDir: true,
        sourcemap: false,
        minify: 'terser',
    },
});
