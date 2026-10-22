import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // supabase/tests runs separately with `npm run test:rls`.
    include: ["src/**/*.test.ts"],
  },
});
