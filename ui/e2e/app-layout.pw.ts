import { expect, test } from "@playwright/test";

test("renders separated workspace panels across supported devices", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByTitle("Hide Chat")).toBeVisible();
  await expect(page.getByRole("button", { name: "Files", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editor", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Git", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview", exact: true })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath(`layout-${testInfo.project.name}.png`), fullPage: true });
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});

test("supports collapsing and expanding every main workspace region", async ({ page }) => {
  await page.goto("/");

  for (const panel of ["Files", "Editor", "Chat"]) {
    await page.getByTitle(`Hide ${panel}`).click();
    await expect(page.getByTitle(`Show ${panel}`)).toBeVisible();
    await page.getByTitle(`Show ${panel}`).click();
    await expect(page.getByTitle(`Hide ${panel}`)).toBeVisible();
  }

  await page.getByTitle("Collapse bottom panel").click();
  await expect(page.getByTitle("Expand bottom panel")).toBeVisible();
  await page.getByTitle("Expand bottom panel").click();
  await expect(page.getByTitle("Collapse bottom panel")).toBeVisible();
});

test("keeps chat visible as the primary small-screen workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByTitle("Hide Chat")).toBeVisible();
  await expect(page.getByText("Start a Codex run from the composer.")).toBeVisible();
});
