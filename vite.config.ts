/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  base: "./",
  server: { host: "127.0.0.1", port: 43123, strictPort: true },
  preview: { host: "127.0.0.1", port: 43123, strictPort: true },
  build: { target: "es2022", cssCodeSplit: false, assetsInlineLimit: 100000000 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
