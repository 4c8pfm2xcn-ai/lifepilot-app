import path from "node:path";

import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname),
  // `server-only` throws outside a React Server environment; stub it for tests.
  "server-only": path.resolve(__dirname, "tests/support/server-only.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/db/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
