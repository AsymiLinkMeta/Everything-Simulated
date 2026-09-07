import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@tanstack/react-router": path.resolve(root, "src/shims/tanstack-react-router.tsx"),
      "@tanstack/react-start": path.resolve(root, "src/shims/tanstack-start.ts"),
    },
  },
  server: { host: true, port: 5173 },
});
