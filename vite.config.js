import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(dirname('src/index.js')),
            name: 'DigDug',
            formats: ['es', 'umd'],
            // Standardize naming: digdug.es.js and digdug.umd.js
            fileName: (format) => `digdug.${format}.js`,
        },
        rollupOptions: {
            // If you decide to use any external libs (like an audio engine),
            // list them here so they aren't bundled.
            external: [],
            output: {
                // Keeps your assets organized in the dist folder
                assetFileNames: 'assets/[name].[ext]',
                globals: {
                    // Define globals for UMD build if needed
                },
            },
        },
        sourcemap: true,
        minify: 'terser', // Smaller bundle size for production
    },
});
