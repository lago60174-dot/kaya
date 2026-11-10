import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    testTimeout: 60000,
    hookTimeout: 120000,
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "server/**/service.ts"],
      exclude: [
        "**/*.test.ts",
        "lib/supabase/**",
        "lib/env.ts",
        "lib/utils.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
