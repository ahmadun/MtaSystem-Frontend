import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",
      workbox: { clientsClaim: true, skipWaiting: true, maximumFileSizeToCacheInBytes: 9000000 }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2000
  },
  resolve: {
    alias: {
      "@api": path.resolve(__dirname, "src/api"),
      app: path.resolve(__dirname, "src/app")
    }
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    },
    proxy: {
      "/uploads": {
        target: "http://localhost:5033",
        changeOrigin: true
      }
    }
  }
});
