import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // supabase/tests runs separately with `npm run test:rls`.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
