import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Builds the website renderer for the API server (one self-contained CommonJS file).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src/knowvato-main") } },
  ssr: { noExternal: true },
  publicDir: false,
  build: {
    ssr: "src/website-builder/ssr-entry.jsx",
    outDir: "dist-ssr",
    emptyOutDir: true,
    rollupOptions: { output: { format: "cjs", entryFileNames: "site-ssr.cjs" } },
  },
});
