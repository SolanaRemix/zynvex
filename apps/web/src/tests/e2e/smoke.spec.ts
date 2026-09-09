import { test, expect } from "@playwright/test";

test("loads auth page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ZYNVEX Enterprise")).toBeVisible();
});
