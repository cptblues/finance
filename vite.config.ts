import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: Boolean(process.env.TAURI_DEBUG),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/d3") || id.includes("node_modules/victory-vendor")) return "charts";
          if (id.includes("node_modules/@tanstack")) return "tables";
          if (id.includes("node_modules")) return "vendor";
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
