import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

test.describe("authentication", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ADMIN.email);
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/login");
  });

  test("logs in with valid credentials and lands on the dashboard", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await expect(page.getByText("Mini issue tracker")).toBeVisible();
  });
});
