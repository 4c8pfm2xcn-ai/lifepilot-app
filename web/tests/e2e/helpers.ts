import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-42";

export function uniqueEmail(tag: string) {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
}

export async function signUp(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/onboarding");
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/today");
}

export async function skipOnboarding(page: Page) {
  await page.getByTestId("skip-onboarding").click();
  await page.waitForURL("**/today");
}

/** Set working hours to the full day so planning tests don't depend on wall-clock time. */
export async function setAllDayHours(page: Page) {
  await page.goto("/settings#planning");
  await page.getByLabel("End of working hours").fill("23:59");
  await page.getByLabel("Start of working hours").fill("00:00");
  await expect(page.getByLabel("Start of working hours")).toHaveValue("00:00");
}

export async function createTask(page: Page, title: string, opts: { dueDate?: string; estimate?: string } = {}) {
  await page.goto("/tasks?view=all");
  await page.getByTestId("new-task").click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill(title);
  if (opts.dueDate) await dialog.getByLabel("Due date").fill(opts.dueDate);
  if (opts.estimate) await dialog.getByLabel("Estimate").selectOption(opts.estimate);
  await dialog.getByTestId("save-task").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("task-row").filter({ hasText: title })).toBeVisible();
}

export function localDateKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
