import { test, expect } from "@playwright/test";
import { ADMIN, ALICE, login } from "./helpers";

interface IssueRow {
  id: string;
  reporter: { email: string };
}

test.describe("delete authorization", () => {
  test("a MEMBER cannot delete an issue they did not report (403)", async ({
    page,
  }) => {
    await login(page, ALICE);

    // Find an issue reported by someone else (admin seeds several).
    const res = await page.request.get("/api/issues");
    expect(res.ok()).toBeTruthy();
    const { issues } = (await res.json()) as { issues: IssueRow[] };
    const foreign = issues.find((i) => i.reporter.email === ADMIN.email);
    expect(foreign, "expected a seeded admin-reported issue").toBeTruthy();

    const del = await page.request.delete(`/api/issues/${foreign!.id}`);
    expect(del.status()).toBe(403);
    // And it must still exist.
    const after = await page.request.get("/api/issues");
    const { issues: remaining } = (await after.json()) as { issues: IssueRow[] };
    expect(remaining.some((i) => i.id === foreign!.id)).toBeTruthy();
  });

  test("an ADMIN can delete any issue (200)", async ({ page }) => {
    await login(page, ADMIN);

    // Create one to delete so we don't disturb other specs' fixtures.
    const created = await page.request.post("/api/issues", {
      data: {
        title: "E2E admin-delete target",
        description: "created then deleted by the admin-delete spec",
        priority: "low",
      },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const del = await page.request.delete(`/api/issues/${id}`);
    expect(del.ok()).toBeTruthy();
  });

  test("unknown assignee is rejected with 400, not 500", async ({ page }) => {
    await login(page, ADMIN);
    const res = await page.request.post("/api/issues", {
      data: {
        title: "E2E bad assignee",
        description: "well-formed cuid that does not exist",
        priority: "low",
        assigneeId: "clzzzzzzzzzzzzzzzzzzzzzzz",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid status filter is rejected with 400, not 500", async ({
    page,
  }) => {
    await login(page, ADMIN);
    const res = await page.request.get("/api/issues?status=bogus");
    expect(res.status()).toBe(400);
  });
});
