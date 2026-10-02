import { expect, test } from "@playwright/test";
import { createTask, localDateKey, setAllDayHours, signIn, signUp, skipOnboarding, uniqueEmail } from "./helpers";

/**
 * Major user journeys, run end-to-end in a real browser against a production
 * build in demo mode (browser-local accounts, on-device AI fallbacks).
 * Tests share one browser context so the "user" persists across steps.
 */
test.describe.configure({ mode: "serial" });

const email = uniqueEmail("ada");
let page: import("@playwright/test").Page;

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
});

test("1–2. new user signs up and completes onboarding", async () => {
  await signUp(page, "Ada Lovelace", email);
  await expect(page.getByRole("heading", { name: "Your life, finally organized." })).toBeVisible();
  await page.getByLabel("What should we call you?").fill("Ada");
  await page.getByTestId("onboarding-next").click();

  await page.getByRole("button", { name: /School/ }).click();
  await page.getByRole("button", { name: /Business/ }).click();
  await expect(page.getByRole("button", { name: /School/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("onboarding-next").click();

  await page.getByRole("tab", { name: "Evening before" }).click();
  await page.getByTestId("onboarding-next").click();

  // AI capture intro — runs the real extraction endpoint (on-device fallback without a key)
  await page.getByTestId("onboarding-try").click();
  await expect(page.getByRole("list", { name: "What DAYZERO found" })).toContainText("Chemistry homework");
  await expect(page.getByRole("list", { name: "What DAYZERO found" })).toContainText("Dentist");
  await page.getByTestId("onboarding-next").click();

  await expect(page.getByRole("heading", { name: /Your dashboard is ready, Ada/ })).toBeVisible();
  await page.getByTestId("onboarding-finish").click();
  // the tried capture lands in the inbox for review
  await page.waitForURL("**/inbox");
  await expect(page.getByTestId("inbox-item")).toHaveCount(1);
});

test("3–5. create a task, complete it, and it persists after refresh", async () => {
  await createTask(page, "Write lab report", { dueDate: localDateKey(0), estimate: "60" });
  const row = page.getByTestId("task-row").filter({ hasText: "Write lab report" });
  await row.getByRole("checkbox", { name: "Complete Write lab report" }).click();
  await expect(page.getByText("Completed “Write lab report”")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Completed/ }).click();
  await expect(page.getByTestId("task-row").filter({ hasText: "Write lab report" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Reopen Write lab report" })).toHaveAttribute("aria-checked", "true");

  // reopen works too
  await page.getByRole("checkbox", { name: "Reopen Write lab report" }).click();
  await page.getByRole("tab", { name: /^All/ }).click();
  await expect(page.getByTestId("task-row").filter({ hasText: "Write lab report" })).toBeVisible();
});

test("quick-add understands natural language and delete has undo", async () => {
  await page.goto("/tasks?view=all");
  await page.getByTestId("quick-add").fill("Pay rent tomorrow, urgent");
  await expect(page.getByText(/Will add/)).toContainText("tomorrow");
  await page.getByTestId("quick-add").press("Enter");
  const row = page.getByTestId("task-row").filter({ hasText: "Pay rent" });
  await expect(row).toContainText("Tomorrow");
  await expect(row).toContainText("Urgent");

  await row.getByRole("button", { name: "More actions for Pay rent" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("task-row").filter({ hasText: "Pay rent" })).toBeVisible();
});

test("6. create a calendar event", async () => {
  await page.goto("/calendar");
  await page.getByTestId("new-event").click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill("Physics study group");
  await dialog.getByLabel("Date").fill(localDateKey(1));
  await dialog.getByLabel("Starts").fill("10:00");
  await dialog.getByLabel("Ends").fill("11:30");
  await dialog.getByTestId("save-event").click();
  await expect(dialog).toBeHidden();
  await page.getByRole("tab", { name: "Agenda" }).click();
  await expect(page.locator(".fc").getByText("Physics study group")).toBeVisible();
});

test("conflicting event shows a clear warning before saving", async () => {
  await page.goto("/calendar");
  await page.getByTestId("new-event").click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill("Dentist");
  await dialog.getByLabel("Date").fill(localDateKey(1));
  await dialog.getByLabel("Starts").fill("11:00");
  await dialog.getByLabel("Ends").fill("12:00");
  await dialog.getByTestId("save-event").click();
  await expect(dialog.getByRole("alert")).toContainText("Physics study group");
  await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("7–8. capture an inbox item, edit the extracted task, accept it", async () => {
  await page.goto("/inbox");
  await page.getByTestId("inbox-input").fill("Remember I have chemistry homework due Thursday and need to call the supplier Friday.");
  await page.getByTestId("inbox-submit").click();
  const card = page.getByTestId("inbox-item").first();
  await expect(card.getByTestId("extracted-item")).toHaveCount(2);
  const first = card.getByTestId("extracted-item").first();
  await expect(first.getByLabel("Title")).toHaveValue("Chemistry homework");

  await first.getByLabel("Title").fill("Chemistry homework — chapter 5");
  await first.getByRole("button", { name: "Edit details" }).click();
  await first.getByLabel("Priority").selectOption("high");
  await first.getByTestId("accept-task").click();
  await expect(card).toContainText("Added as task");

  await page.goto("/tasks?view=all");
  const row = page.getByTestId("task-row").filter({ hasText: "Chemistry homework — chapter 5" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("High");
  await expect(row).toContainText("School");
});

test("rejects unsupported uploads with a clear message", async () => {
  await page.goto("/inbox");
  await page.getByTestId("inbox-file").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByText(/PDFs aren't supported yet/)).toBeVisible();
});

test("9–10. generate a daily plan and confirm it", async () => {
  await setAllDayHours(page);
  await createTask(page, "Draft essay outline", { dueDate: localDateKey(1), estimate: "45" });
  await page.goto("/today");
  await page.getByTestId("plan-my-day").click();
  const dialog = page.getByRole("dialog", { name: "Plan my day" });
  await dialog.getByRole("tab", { name: "Tomorrow" }).click();
  await expect(dialog.getByRole("list", { name: /Proposed schedule/ })).toContainText("Draft essay outline");
  // existing events are shown as fixed, never moved
  await expect(dialog.getByRole("list", { name: /Proposed schedule/ })).toContainText("Physics study group");
  await expect(dialog).toContainText("Calendar event · fixed");
  await dialog.getByTestId("apply-plan").click();
  await expect(page.getByText(/Scheduled \d+ task/)).toBeVisible();

  await page.goto("/tasks?view=all");
  const row = page.getByTestId("task-row").filter({ hasText: "Draft essay outline" });
  await expect(row).toContainText(/\d{1,2}:\d{2}\s?[AP]M\s–\s\d{1,2}:\d{2}\s?[AP]M/);
});

test("assistant answers from data and only changes things after confirmation", async () => {
  await page.goto("/assistant");
  await page.getByTestId("assistant-input").fill("Add call the dentist tomorrow");
  await page.getByTestId("assistant-input").press("Enter");
  const card = page.getByTestId("action-card").first();
  await expect(card).toContainText("Create task");
  // nothing created yet
  await page.goto("/tasks?view=all");
  await expect(page.getByTestId("task-row").filter({ hasText: /call the dentist/i })).toHaveCount(0);
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Add call the dentist tomorrow" }).first().click();
  await page.getByTestId("confirm-action").first().click();
  await expect(page.getByText("✓ Applied")).toBeVisible();
  await page.goto("/tasks?view=all");
  await expect(page.getByTestId("task-row").filter({ hasText: /call the dentist/i })).toBeVisible();
});

test("11. create a goal with a milestone and see progress", async () => {
  await page.goto("/goals");
  await page.getByTestId("new-goal").click();
  const form = page.getByRole("dialog", { name: "New goal" });
  await form.getByLabel("Goal").fill("Launch my candle shop");
  await form.getByTestId("save-goal").click();
  const detail = page.getByRole("dialog", { name: "Launch my candle shop" });
  await expect(detail).toBeVisible();
  await detail.getByLabel("New milestone").fill("Photograph products");
  await detail.getByRole("button", { name: "Add", exact: true }).click();
  await detail.getByRole("checkbox", { name: "Complete Photograph products" }).click();
  await expect(detail.getByText("100%")).toBeVisible();
  await detail.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByTestId("goal-card").filter({ hasText: "Launch my candle shop" })).toContainText("100%");
});

test("12. insights reflect real records", async () => {
  await page.goto("/tasks?view=all");
  await page.getByRole("checkbox", { name: "Complete Draft essay outline" }).click();
  await page.goto("/insights");
  const tile = page.getByText("Completed this week", { exact: true }).locator("..").locator("..");
  await expect(tile).toContainText("1");
  await expect(page.getByText("Weekly summary")).toBeVisible();
  await expect(page.getByText(/You completed 1 task this week/)).toBeVisible();
  await page.getByRole("button", { name: "Show as tables" }).click();
  await expect(page.getByRole("columnheader", { name: "Completed" }).first()).toBeVisible();
});

test("13. sign out and back in keeps everything", async () => {
  await page.goto("/settings#account");
  await page.getByTestId("sign-out").click();
  await page.waitForURL("**/login");
  await page.goto("/today");
  await page.waitForURL("**/login**");
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: /, Ada/ })).toBeVisible();
  await page.goto("/goals");
  await expect(page.getByTestId("goal-card").filter({ hasText: "Launch my candle shop" })).toBeVisible();
});

test("14. a second user cannot see the first user's data", async () => {
  await page.goto("/settings#account");
  await page.getByTestId("sign-out").click();
  await page.waitForURL("**/login");
  await signUp(page, "Bo", uniqueEmail("bo"));
  await skipOnboarding(page);
  await page.goto("/tasks?view=all");
  await expect(page.getByTestId("task-row")).toHaveCount(0);
  await page.goto("/goals");
  await expect(page.getByTestId("goal-card")).toHaveCount(0);
  await page.goto("/inbox");
  await expect(page.getByTestId("inbox-item")).toHaveCount(0);
  // wrong password for the first account is rejected
  await page.goto("/settings#account");
  await page.getByTestId("sign-out").click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByTestId("login-submit").click();
  await expect(page.getByText(/don't match an account/)).toBeVisible();
});

test("data export and deletion need explicit confirmation", async () => {
  await signIn(page, email);
  await page.goto("/settings#data");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON" }).click();
  expect((await download).suggestedFilename()).toMatch(/^dayzero-export-.*\.json$/);
  await page.getByTestId("wipe-data").click();
  const dialog = page.getByRole("dialog", { name: "Delete all your data?" });
  await expect(dialog.getByRole("button", { name: "Delete everything" })).toBeDisabled();
  await dialog.getByTestId("confirm-delete-input").fill("DELETE");
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await page.goto("/tasks?view=all");
  await expect(page.getByTestId("task-row")).toHaveCount(0);
});
