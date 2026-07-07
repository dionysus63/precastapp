import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
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
