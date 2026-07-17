import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

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
      "/health": {
        target: "https://api.mrcwoods.com",
        changeOrigin: true,
        secure: true,
      },
      "/images": {
        target: "https://api.mrcwoods.com",
        changeOrigin: true,
        secure: true,
      },
      "/oauth": {
        target: "https://api.mrcwoods.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
