import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function flattenPopupHtml(): Plugin {
  return {
    name: "flatten-popup-html",
    apply: "build",
    closeBundle() {
      const nested = resolve("dist/src/popup/popup.html");
      if (!existsSync(nested)) return;

      const html = readFileSync(nested, "utf8").replaceAll("../", "");
      writeFileSync(resolve("dist/popup.html"), html);
      rmSync(resolve("dist/src"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: resolve("src/popup/popup.html"),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  plugins: [flattenPopupHtml()],
});
