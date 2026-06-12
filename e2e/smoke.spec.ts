import { test, expect } from "@playwright/test";

test("açılış sayfası yüklenir ve login'e yönlendirir", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ingym" })).toBeVisible();
  await page.getByRole("link", { name: "Başla" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByPlaceholder("E-posta")).toBeVisible();
});
