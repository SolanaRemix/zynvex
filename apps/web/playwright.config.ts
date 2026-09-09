import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  }
});
