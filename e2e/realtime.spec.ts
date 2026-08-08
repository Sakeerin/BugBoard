import { test, expect } from "@playwright/test";
import { ADMIN, login, createIssue } from "./helpers";

test.describe("realtime sync (SSE)", () => {
  test("a new issue appears in another open tab", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await login(a, ADMIN);
    await login(b, ADMIN);

    const title = `E2E sync ${Date.now()}`;
    await createIssue(a, title);

    // Tab B never created it — it must arrive over the SSE stream.
    await expect(b.getByText(title)).toBeVisible({ timeout: 10_000 });

    await ctxA.close();
    await ctxB.close();
  });

  test("missed events are recovered after the connection drops and returns", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await login(a, ADMIN);
    await login(b, ADMIN);

    // Drop tab B's connection, then create an issue it will miss.
    await ctxB.setOffline(true);
    const title = `E2E offline ${Date.now()}`;
    await createIssue(a, title);

    // While offline, B must not have it.
    await b.waitForTimeout(1500);
    await expect(b.getByText(title)).toHaveCount(0);

    // On reconnect, onopen triggers a full resync via fetchIssues().
    await ctxB.setOffline(false);
    await expect(b.getByText(title)).toBeVisible({ timeout: 20_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
