import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@tanstack/react-router": path.resolve(root, "src/shims/tanstack-react-router.tsx"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // src/lib/db.ts creates a Supabase client at import time; tests never hit the network.
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
