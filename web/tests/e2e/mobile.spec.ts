import { expect, test } from "@playwright/test";

test.describe("mobile experience", () => {
  test("demo workspace: every screen fits the viewport and navigation works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try the demo" }).click();
    await page.waitForURL("**/today");

    for (const path of ["/today", "/inbox", "/tasks", "/calendar", "/goals", "/assistant", "/insights", "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }

    // bottom navigation
    const nav = page.getByRole("navigation", { name: "Primary" });
    await nav.getByRole("link", { name: "Tasks" }).click();
    await page.waitForURL("**/tasks");
    await nav.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "More" }).getByRole("link", { name: "Goals" }).click();
    await page.waitForURL("**/goals");

    // floating capture button
    await page.getByTestId("fab-capture").click();
    const capture = page.getByRole("dialog", { name: "Capture" });
    await expect(capture).toBeVisible();
    await capture.getByLabel("What's on your mind?").fill("Pick up dry cleaning tomorrow");
    await capture.getByTestId("capture-submit").click();
    await page.waitForURL("**/inbox**");
    await expect(page.getByTestId("inbox-item").filter({ hasText: "Pick up dry cleaning" })).toBeVisible();
  });
});
