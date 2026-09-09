import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  },
  webServer: {
    command: "npm run dev",
    url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    timeout: 120000,
    reuseExistingServer: true
  }
});
