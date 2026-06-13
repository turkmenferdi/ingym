import { test, expect } from "@playwright/test";

test("korumalı sayfalar oturumsuz login'e yönlendirir", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
