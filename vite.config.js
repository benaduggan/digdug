import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'DigDug',
            formats: ['es', 'umd'],
            fileName: (format) => `digdug.${format}.js`,
        },
        rollupOptions: {
            output: {
                assetFileNames: 'assets/[name][extname]',
            },
        },
        sourcemap: true,
    },
    server: {
        open: true,
    },
    // Ensure assets are properly handled
    assetsInclude: [
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.gif',
        '**/*.svg',
        '**/*.mp3',
        '**/*.wav',
        '**/*.ogg',
    ],
});
