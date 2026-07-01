import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/echo-forge-idle-arpg/" : "/",
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/]phaser/.test(id)) {
            return "phaser";
          }
          return undefined;
        },
      },
    },
  },
  plugins: [react()],
}));
