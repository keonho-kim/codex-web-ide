import { expect, test } from "@playwright/test";

test("renders separated project panels across supported devices", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Editor", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Control", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Codex Usage", exact: true })).toBeVisible();
  await expect(page.getByText("Threads")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  await expect(page.getByTitle("Remove orch")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Start preview|Preview/ })).toHaveCount(0);

  await page.getByRole("tab", { name: "Control", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Git", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Jobs", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Previews", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Services", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Codex Usage", exact: true }).click();
  await expect(page.getByText("Native /status view for the active session.")).toBeVisible();
  const workbenchBox = await page.getByTestId("workbench").boundingBox();
  expect(workbenchBox?.height ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 0) * 0.65);

  await page.screenshot({ path: testInfo.outputPath(`layout-${testInfo.project.name}.png`), fullPage: true });
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});

test("supports sidebar collapse and primary project tabs", async ({ page }, testInfo) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await expect(page.getByText("No file open")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open terminal", exact: true })).toBeVisible();
  await page.keyboard.press("Control+`");
  await expect(page.getByTestId("editor-terminal-panel")).toBeVisible();
  await page.keyboard.press("Control+`");
  await expect(page.getByTestId("editor-terminal-panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show files", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();

  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const sidebarBox = await page.getByTestId("sidebar").boundingBox();
    expect(sidebarBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
    const expandBox = await page.getByRole("button", { name: "Expand sidebar", exact: true }).boundingBox();
    const addProjectBox = await page.getByRole("button", { name: "Add project", exact: true }).boundingBox();
    const projectBox = await page.getByTitle("orch", { exact: true }).boundingBox();
    const centers = [expandBox, addProjectBox, projectBox].map((box) => (box ? box.x + box.width / 2 : Number.NaN));
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1);
  }
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
});

test("shows a React folder browser in the add project dialog", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add project" })).toBeVisible();
  await expect(page.getByPlaceholder("~")).toHaveValue("~");
  await expect(page.getByRole("button", { name: "Go to path", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("New folder name")).toBeVisible();
  await expect(page.getByRole("button", { name: "New folder", exact: true })).toBeVisible();
});

test("supports Codex slash command composer surfaces", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Composer slash-command editing is covered on desktop; responsive layout is covered separately.");
  await page.goto("/");

  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type("/status");
  await page.getByRole("button", { name: /\/status show current session/ }).click();
  await expect(page.getByRole("tab", { name: "Codex Usage", exact: true })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("Slash Commands")).toBeVisible();

  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type("/statusline");
  await page.getByRole("button", { name: /\/statusline configure which/ }).click();
  await expect(page.getByRole("dialog", { name: "/statusline" })).toBeVisible();
  await expect(page.getByText("Status line items")).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("dialog", { name: "/statusline" })).toHaveCount(0);
});

test("keeps chat visible as the primary small-screen project view", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
});
