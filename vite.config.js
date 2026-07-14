import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The React client lives in client/. In dev, Vite serves it on :5173 and proxies
// /api to the Node API on :3000. `npm run build` emits into client/dist, which the
// API server serves in production (npm start).
export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      // Single source of truth for split/settle math, shared with the server.
      "@core": fileURLToPath(new URL("./core", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
