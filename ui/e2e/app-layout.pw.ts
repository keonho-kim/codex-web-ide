import { expect, test, type Page } from "@playwright/test";

async function openApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

test("renders separated project panels across supported devices", async ({ page }, testInfo) => {
  await openApp(page);

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Editor", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Control", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Codex Usage", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open global configuration", exact: true })).toBeVisible();
  if (testInfo.project.name === "pixel-7") {
    await expect(page.getByRole("button", { name: "Open navigation menu", exact: true })).toBeVisible();
    const statusBox = await page.getByTitle("Git branch").boundingBox();
    const tabsBox = await page.getByRole("tablist", { name: "Primary project views" }).boundingBox();
    expect(tabsBox?.y ?? 0).toBeGreaterThan((statusBox?.y ?? 0) + (statusBox?.height ?? 0) - 1);
    await page.getByRole("button", { name: "Open navigation menu", exact: true }).click();
    await expect(page.getByTestId("mobile-navigation-menu")).toBeVisible();
    await page.getByTestId("mobile-navigation-menu").getByRole("button", { name: "Editor", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Editor", exact: true })).toHaveAttribute("data-state", "active");
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Threads" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  await expect(page.getByTitle("Remove orch")).toHaveCount(1);
  await expect(page.getByTestId("project-chat-session").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Start preview|Preview/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Open global configuration", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Global Configuration" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runtime" })).toBeVisible();
  await expect(page.getByText("Status line items")).toBeVisible();
  await page.getByText("Experimental features").scrollIntoViewIfNeeded();
  await expect(page.getByText("Experimental features")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Global Configuration" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Control", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Git", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Jobs", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Previews", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Services", exact: true })).toBeVisible();
  const workbenchBox = await page.getByTestId("workbench").boundingBox();
  if (testInfo.project.name === "pixel-7") {
    const sidebarBox = await page.getByTestId("sidebar").boundingBox();
    expect((workbenchBox?.y ?? 0) - (sidebarBox?.y ?? 0)).toBeGreaterThan(80);
    expect(workbenchBox?.height ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 0) * 0.3);
  } else {
    expect(workbenchBox?.height ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 0) * 0.65);
  }

  await page.screenshot({ path: testInfo.outputPath(`layout-${testInfo.project.name}.png`), fullPage: true });
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});

test("supports sidebar collapse and primary project tabs", async ({ page }, testInfo) => {
  await openApp(page);

  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await expect(page.getByText("No file open")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open terminal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show files", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
  const expandedSidebarBox = testInfo.project.name === "pixel-7" ? await page.getByTestId("sidebar").boundingBox() : null;
  if (testInfo.project.name === "pixel-7") {
    const sidebarBox = await page.getByTestId("sidebar").boundingBox();
    const workbenchBox = await page.getByTestId("workbench").boundingBox();
    expect((workbenchBox?.y ?? 0) - (sidebarBox?.y ?? 0)).toBeGreaterThan(80);
  }

  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  if (testInfo.project.name === "pixel-7") {
    const collapsedSidebarBox = await page.getByTestId("sidebar").boundingBox();
    expect(collapsedSidebarBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan((expandedSidebarBox?.height ?? 0) * 0.6);
  }
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
  await openApp(page);

  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to path", exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("New folder name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New folder", exact: true })).toHaveCount(0);
  await expect(page.getByTitle("Parent folder")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true }).last()).toBeVisible();
});

test("supports Codex slash command composer surfaces", async ({ page }, testInfo) => {
  test.skip(true, "Composer slash-command behavior is covered outside the responsive layout smoke suite.");
  test.skip(testInfo.project.name !== "desktop", "Composer slash-command editing is covered on desktop; responsive layout is covered separately.");
  await openApp(page);

  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type("/");
  await expect(page.getByTestId("slash-command-suggestions")).toBeVisible();
  expect(await page.getByTestId("slash-command-option").count()).toBeGreaterThan(10);
  await page.keyboard.type("pl");
  await expect(page.getByTestId("slash-command-option").first()).toContainText("/plan");
  await page.keyboard.press("Enter");
  await expect(page.locator('[contenteditable="true"]')).toContainText("/plan");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");

  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type("/statusline");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "/statusline" })).toBeVisible();
  await expect(page.getByText("Status line items")).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("dialog", { name: "/statusline" })).toHaveCount(0);
  await expect(page.getByText(/Applied \/statusline through the Codex Web native command surface/).last()).toBeVisible();
});

test("keeps chat visible as the primary small-screen project view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "Small-screen primary chat access is covered on mobile and tablet targets.");
  await openApp(page);

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
});
