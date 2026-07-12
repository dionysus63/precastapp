import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite resolves tsconfig path aliases natively now; the old
    // vite-tsconfig-paths plugin was removed as redundant.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Integration tests share one scratch database — run files serially so
    // fixtures in one file can't race another.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
