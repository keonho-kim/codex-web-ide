import { expect, test, type Page } from "@playwright/test";

async function openApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

async function openSeededApp(page: Page) {
  await ensureOrchProject(page);
  await openApp(page);
}

function json(body: unknown) {
  return {
    body: JSON.stringify(body),
    contentType: "application/json",
  };
}

type E2eProject = {
  id: string;
  cwd: string;
  name: string;
};

type E2eSession = {
  id: string;
  projectId?: string;
};

async function ensureOrchProject(page: Page) {
  const cwd = "/Users/khkim/dev/orch";
  const projects = (await (await page.request.get("/api/projects")).json()) as E2eProject[];
  const project = projects.find((item) => item.cwd === cwd) ?? ((await (await page.request.post("/api/projects", { data: { cwd, name: "orch" } })).json()) as E2eProject);
  await page.request.post(`/api/projects/${project.id}/open`);

  const sessions = (await (await page.request.get("/api/sessions")).json()) as E2eSession[];
  const session = sessions.find((item) => item.projectId === project.id) ?? ((await (await page.request.post("/api/sessions", { data: { projectId: project.id } })).json()) as E2eSession);
  const threads = (await (await page.request.get(`/api/sessions/${session.id}/codex/threads`)).json()) as { threads: unknown[] };
  if (threads.threads.length === 0) await page.request.post(`/api/sessions/${session.id}/codex/threads`, { data: { title: "Thread 1" } });
}

async function installNoThreadProjectRoutes(page: Page) {
  const project = { id: "project-empty", name: "zeroShot", cwd: "/tmp/zeroShot", lastOpenedAt: Date.now() };
  const thread = { id: "thread-1", sessionId: "session-empty", title: "Thread 1", createdAt: Date.now(), lastActiveAt: Date.now() };
  let session: unknown;
  let runStarted = false;
  let cancelCalled = false;
  let releaseRun = () => {};
  const runGate = new Promise<void>((resolve) => {
    releaseRun = resolve;
  });

  await page.route("**/api/projects", (route) => route.fulfill(json([project])));
  await page.route("**/api/workspace/settings", (route) =>
    route.fulfill(json({ activeProjectId: project.id, recentProjectIds: [project.id], defaultProjectsDir: "/tmp", host: "127.0.0.1", port: 17325, previewPortStart: 17330, previewPortEnd: 17399 })),
  );
  await page.route("**/api/sessions/events**", (route) => route.fulfill({ body: "retry: 1000\n\n: connected\n\n", contentType: "text/event-stream" }));
  await page.route("**/api/sessions", async (route) => {
    if (route.request().method() === "POST") {
      session = { id: "session-empty", projectId: project.id, cwd: project.cwd, name: project.name, createdAt: Date.now(), lastActiveAt: Date.now(), status: "idle" };
      await route.fulfill(json(session));
      return;
    }
    await route.fulfill(json(session ? [session] : []));
  });
  await page.route("**/api/sessions/session-empty/codex/messages", (route) => route.fulfill(json([])));
  await page.route("**/api/sessions/session-empty/codex/resume", (route) => route.fulfill(json({ running: runStarted && !cancelCalled, messages: [], thread: runStarted ? thread : null })));
  await page.route("**/api/sessions/session-empty/codex/threads", async (route) => {
    if (route.request().method() === "POST") {
      runStarted = true;
      await route.fulfill(json(thread));
      return;
    }
    await route.fulfill(json({ threads: runStarted ? [thread] : [], activeThreadId: runStarted ? thread.id : null }));
  });
  await page.route("**/api/sessions/session-empty/codex/run", async (route) => {
    runStarted = true;
    session = { ...(session as object), status: "running" };
    await runGate;
    await route.fulfill(json({ running: true, threadId: thread.id }));
  });
  await page.route("**/api/sessions/session-empty/codex/cancel", (route) => {
    cancelCalled = true;
    session = { ...(session as object), status: "idle" };
    return route.fulfill(json({ running: false }));
  });

  return {
    cancelCalled: () => cancelCalled,
    releaseRun,
    runStarted: () => runStarted,
  };
}

test("renders separated project panels across supported devices", async ({ page }, testInfo) => {
  await openSeededApp(page);

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
  await openSeededApp(page);

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

test("starts a new chat from the composer when a project has no threads", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The no-thread composer bootstrap is covered once on desktop with mocked API state.");
  const mock = await installNoThreadProjectRoutes(page);
  await openApp(page);

  await expect(page.getByText("No chats yet. Start a new chat.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toHaveCount(0);
  await expect(page.getByText("tokens")).toHaveCount(0);
  await expect(page.getByText("changes")).toHaveCount(0);

  await page.getByRole("button", { name: "Open composer context", exact: true }).click();
  const contextPanel = page.getByTestId("composer-context-panel");
  await expect(contextPanel).toBeVisible();
  await expect(contextPanel.getByText("Model")).toBeVisible();
  await expect(contextPanel.getByText("Sandbox")).toBeVisible();
  await expect(contextPanel.getByText("Approvals")).toBeVisible();
  await expect(contextPanel.getByText("Token usage")).toBeVisible();

  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type("이 프로젝트를 설명해줘");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(mock.runStarted).toBe(true);
  await expect(page.getByRole("button", { name: "Interrupt Codex", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Interrupt Codex", exact: true }).click();
  await expect.poll(mock.cancelCalled).toBe(true);
  mock.releaseRun();
  await expect(page.locator('[contenteditable="true"]')).toHaveText("");
});

test("shows a React folder browser in the add project dialog", async ({ page }) => {
  await openSeededApp(page);

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
  await openSeededApp(page);

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
  await openSeededApp(page);

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
});
