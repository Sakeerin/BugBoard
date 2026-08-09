import { type Page, expect } from "@playwright/test";

export const ADMIN = { email: "admin@bugboard.dev", password: "admin123" };
export const ALICE = { email: "alice@bugboard.dev", password: "member123" };

/** Log in through the real UI and wait until the dashboard is shown. */
export async function login(
  page: Page,
  { email, password }: { email: string; password: string }
) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "+ New Issue" })).toBeVisible();
}

/** Create an issue through the modal and wait for it to appear on the board. */
export async function createIssue(page: Page, title: string) {
  await page.getByRole("button", { name: "+ New Issue" }).click();
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="description"]', `${title} — description`);
  await page.getByRole("button", { name: "Create Issue" }).click();
  // Match the card heading specifically — the description also contains the
  // title as a substring, which would make a plain getByText ambiguous.
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}
