import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const target = process.env.VITE_PROXY_TARGET || "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: { usePolling: true, interval: 300 },
    proxy: {
      "/api": { target, changeOrigin: true },

      // 👇 мынаны қос
      "/static": { target, changeOrigin: true },
      // егер фотолар /uploads арқылы келсе, мұны да қос
      "/uploads": { target, changeOrigin: true },
    },
  },
});