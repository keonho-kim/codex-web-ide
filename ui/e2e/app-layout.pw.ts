import { expect, test } from "@playwright/test";

test("renders separated project panels across supported devices", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Editor", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Control", exact: true })).toBeVisible();
  await expect(page.getByText("Threads")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start preview|Preview/ })).toBeVisible();

  await page.getByRole("tab", { name: "Control", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Git", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Jobs", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Services", exact: true })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath(`layout-${testInfo.project.name}.png`), fullPage: true });
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});

test("supports sidebar collapse and primary project tabs", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await expect(page.getByText("No file open")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show files", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.getByText("Start a Codex run from the composer.")).toBeVisible();

  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
});

test("shows a React folder browser in the add project dialog", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("New folder name")).toBeVisible();
  await expect(page.getByRole("button", { name: "New folder", exact: true })).toBeVisible();
});

test("keeps chat visible as the primary small-screen project view", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByText("Start a Codex run from the composer.")).toBeVisible();
});
