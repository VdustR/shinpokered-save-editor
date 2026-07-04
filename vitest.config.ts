import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests live under src/. E2E specs under tests/e2e are Playwright's.
    include: ["src/**/*.test.ts"],
  },
});
