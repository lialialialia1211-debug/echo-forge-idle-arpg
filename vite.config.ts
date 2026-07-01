import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/echo-forge-idle-arpg/" : "/",
  plugins: [react()],
}));
