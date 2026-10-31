import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

function nameContentCss(): Plugin {
  return {
    name: "name-content-css",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === "asset" && item.fileName.endsWith(".css")) {
          item.fileName = "content.css";
        }
      }
    },
  };
}

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve("src/content/content.ts"),
      name: "YouTubeGroupsContent",
      formats: ["iife"],
      fileName: () => "content.js",
      cssFileName: "content",
    },
    rollupOptions: {
      output: {
        entryFileNames: "content.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  plugins: [nameContentCss()],
});
