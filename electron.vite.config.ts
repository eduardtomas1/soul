import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const shared = { "@shared": resolve("src/shared") };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: shared },
    build: {
      target: "node22",
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        input: { index: resolve("src/main/index.ts") },
      },
    },
  },
  preload: {
    resolve: { alias: shared },
    build: {
      target: "node22",
      sourcemap: false,
      rollupOptions: {
        external: ["electron"],
        input: { index: resolve("src/preload/index.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": resolve("src/renderer/src"), ...shared } },
    build: {
      target: "chrome140",
      sourcemap: false,
      minify: "esbuild",
      assetsInlineLimit: 0,
      rollupOptions: {
        input: { index: resolve("src/renderer/index.html") },
      },
    },
  },
});
