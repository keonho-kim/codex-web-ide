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

function isCompactViewport(page: Page) {
  return (page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 1100;
}

function isNarrowViewport(page: Page) {
  return (page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 700;
}

async function ensureOrchProject(page: Page) {
  const cwd = "/Users/khkim/dev/orch";
  const projects = (await (await page.request.get("/api/projects")).json()) as E2eProject[];
  const project = projects.find((item) => item.cwd === cwd) ?? ((await (await page.request.post("/api/projects", { data: { cwd, name: "orch" } })).json()) as E2eProject);
  await page.request.post(`/api/projects/${project.id}/open`);

  const sessions = (await (await page.request.get("/api/sessions")).json()) as E2eSession[];
  const session = sessions.find((item) => item.projectId === project.id) ?? ((await (await page.request.post("/api/sessions", { data: { projectId: project.id } })).json()) as E2eSession);
  const threads = (await (await page.request.get(`/api/sessions/${session.id}/codex/threads`)).json()) as { threads: unknown[] };
  if (threads.threads.length === 0) await page.request.post(`/api/sessions/${session.id}/codex/threads`, { data: { title: "Thread 1" } });
  return { project, session };
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
  await page.route("**/api/sessions/session-empty/codex/status", (route) =>
    route.fulfill(
      json({
        session: session ?? { id: "session-empty", projectId: project.id, cwd: project.cwd, name: project.name, createdAt: Date.now(), lastActiveAt: Date.now(), status: "idle" },
        thread: runStarted ? thread : null,
        model: { label: "Codex SDK default", source: "runtime default" },
        permissions: { sandbox: "workspace-write", approvals: "on-request" },
        git: { branch: "main", detached: false, commit: "abc123", dirty: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0 },
        usage: { note: "Not available yet" },
        commands: { supported: 40, source: "test" },
      }),
    ),
  );
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
  await page.route("**/api/sessions/session-empty/jobs", (route) => route.fulfill(json([])));
  await page.route("**/api/sessions/session-empty/services", (route) => route.fulfill(json([])));

  return {
    cancelCalled: () => cancelCalled,
    releaseRun,
    runStarted: () => runStarted,
  };
}

test("renders separated project panels across supported devices", async ({ page }, testInfo) => {
  await openSeededApp(page);
  const compact = isCompactViewport(page);
  const narrow = isNarrowViewport(page);

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Editor", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "System", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open global configuration", exact: true })).toBeVisible();
  if (compact) {
    await expect(page.getByRole("button", { name: "Open project navigator", exact: true })).toBeVisible();
  }
  if (narrow) {
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
  if (!compact) {
    await expect(page.getByRole("heading", { name: "Threads" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
    await expect(page.getByTitle("Remove orch")).toHaveCount(1);
    await expect(page.getByTestId("project-chat-session").first()).toBeVisible();
  } else {
    await page.getByRole("button", { name: "Open project navigator", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Threads" })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await expect(page.getByRole("button", { name: /Start preview|Preview/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Open global configuration", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Global Configuration" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runtime" })).toBeVisible();
  await expect(page.getByText("Status line items")).toBeVisible();
  await page.getByText("Experimental features").scrollIntoViewIfNeeded();
  await expect(page.getByText("Experimental features")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Global Configuration" })).toHaveCount(0);

  await page.getByRole("tab", { name: "System", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Git", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Runtime", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Codex Usage", exact: true })).toBeVisible();
  const workbenchBox = await page.getByTestId("workbench").boundingBox();
  if (narrow) {
    expect(workbenchBox?.height ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 0) * 0.3);
  } else if (compact) {
    expect(workbenchBox?.height ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 0) * 0.5);
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
  const compact = isCompactViewport(page);
  if (compact) {
    await expect(page.getByRole("button", { name: "Open files", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open files", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Files" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Files" })).toHaveCount(0);
  } else {
    await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hide files", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show files", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Show files", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hide files", exact: true })).toBeVisible();
  }

  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
  if (compact) {
    await page.getByRole("button", { name: "Open project navigator", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Projects" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  if (compact) await expect(page.getByRole("dialog", { name: "Projects" })).toHaveCount(0);
  else await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
  if (!compact) await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const sidebarBox = await page.getByTestId("sidebar").boundingBox();
    expect(sidebarBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
    const expandBox = await page.getByRole("button", { name: "Expand sidebar", exact: true }).boundingBox();
    const addProjectBox = await page.getByRole("button", { name: "Add project", exact: true }).boundingBox();
    const projectBox = await page.getByTitle("orch", { exact: true }).boundingBox();
    const centers = [expandBox, addProjectBox, projectBox].map((box) => (box ? box.x + box.width / 2 : Number.NaN));
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1);
  }
  if (!compact) {
    await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
  }
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
  await expect(page.getByRole("button", { name: "Open composer context", exact: true })).toHaveCount(0);
  await expect(page.getByText("Context:")).toHaveCount(0);
  const statusline = page.getByTestId("codex-statusline");
  await expect(statusline).toBeVisible();
  await expect(statusline).toContainText("Codex SDK default medium");
  await expect(statusline).toContainText("Ready");
  await expect(statusline).toContainText("Tasks 0");

  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type("이 프로젝트를 설명해줘");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(mock.runStarted).toBe(true);
  await expect(statusline).toContainText("/tmp/zeroShot");
  await expect(statusline).toContainText("main");
  await expect(statusline).toContainText("Working");
  await expect(page.getByRole("button", { name: "Interrupt Codex", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Interrupt Codex", exact: true }).click();
  await expect.poll(mock.cancelCalled).toBe(true);
  mock.releaseRun();
  await expect(page.locator('[contenteditable="true"]')).toHaveText("");
});

test("supports editor shortcuts and Monaco context actions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Editor shortcut behavior is covered once on desktop.");
  const { session } = await ensureOrchProject(page);
  await page.request.put(`/api/sessions/${session.id}/files/write`, {
    data: {
      path: "e2e-editor-shortcuts.ts",
      content: "export function targetName() {\n  return targetName();\n}\n",
    },
  });
  await openApp(page);

  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await page.getByRole("button", { name: "e2e-editor-shortcuts.ts", exact: true }).click();
  await expect(page.locator(".monaco-editor")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+J");
  await expect(page.getByTestId("editor-terminal-panel")).toBeVisible();
  await page.getByRole("button", { name: "Kill terminal", exact: true }).click();
  await page.getByRole("button", { name: "Close terminal panel", exact: true }).click();
  await expect(page.getByTestId("editor-terminal-panel")).toHaveCount(0);

  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+Shift+L");
  await page.locator(".monaco-editor").click({ button: "right", position: { x: 160, y: 80 } });
  await expect(page.getByRole("menuitem", { name: /Go to Definition/ }).first()).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Select All Occurrences/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Paste/ }).first()).toBeVisible();
});

test("shows a React folder browser in the add project dialog", async ({ page }) => {
  await openSeededApp(page);

  if (await page.getByRole("button", { name: "Open project navigator", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Open project navigator", exact: true }).click();
  }
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to path", exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("New folder name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New folder", exact: true })).toHaveCount(0);
  await expect(page.getByTitle("Parent folder")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add project", exact: true }).last()).toBeVisible();
});

test("supports Codex slash command composer surfaces", async ({ page }, testInfo) => {
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
  await expect(page.getByText("Applied /statusline through the Codex Web native command surface.")).toHaveCount(0);
});

test("keeps chat visible as the primary small-screen project view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "Small-screen primary chat access is covered on mobile and tablet targets.");
  await openSeededApp(page);

  await expect(page.getByText("Codex Web IDE")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
});

test("keeps responsive orientation layouts usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "Responsive orientation coverage is handled by tablet and mobile targets.");
  await openSeededApp(page);

  await expect(page.getByRole("button", { name: "Open project navigator", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "System", exact: true }).click();
  await page.getByRole("tab", { name: "Runtime", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Previews" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();

  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open files", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open files", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Files" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Files" })).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath(`orientation-${testInfo.project.name}.png`), fullPage: true });
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});
