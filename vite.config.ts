// import { defineConfig } from 'vite';
// import { resolve, dirname } from 'path';
// import { fileURLToPath } from 'url';

// const __dirname = dirname(fileURLToPath(import.meta.url));

// export default defineConfig({
//   build: {
//     outDir: 'dist',
//     emptyOutDir: true,
//     rollupOptions: {
//       input: {
//         popup: resolve(__dirname, 'src/popup/popup.ts'),
//         background: resolve(__dirname, 'src/background.ts'),
//         content: resolve(__dirname, 'src/content/content.ts'),
//         storage: resolve(__dirname, 'src/storage/storage.ts'),
//       },
//       output: {
//         entryFileNames: '[name].js',
//         chunkFileNames: 'chunks/[name].[hash].js',
//         assetFileNames: 'assets/[name].[hash][extname]',
//         // Для background используем iife, чтобы убрать import/export
//         manualChunks: (id) => {
//           if (id.includes('background')) return undefined; // background всегда отдельный файл
//         }
//       }
//     }
//   }
// });

import { defineConfig } from "vite";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                popup: "popup.html",

                background: "src/background.ts",
                content: "src/content/content.ts"
            },

            output: {
                entryFileNames: "[name].js",
                assetFileNames: "[name][extname]"
            }
        }
    }
});