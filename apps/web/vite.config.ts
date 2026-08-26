import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split stable, rarely-changing vendor code from app code so browsers can
        // cache it across deploys, and so the initial /login chunk (which pulls in
        // ToastProvider -> framer-motion at the App root) isn't inflated by
        // libraries only some routes need (react-query, i18next, zod/rhf).
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query", "axios", "zustand"],
          "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
});
