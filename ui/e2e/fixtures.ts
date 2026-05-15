import { expect, test as base, type WorkerInfo } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";

export type E2eWorker = {
  baseURL: string;
  homeDir: string;
  port: number;
  projectDir: string;
  projectName: string;
};

type TestFixtures = {
  e2eWorker: E2eWorker;
};

type WorkerFixtures = {
  workerServer: E2eWorker;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const e2eRoot = path.join(repoRoot, ".cache/e2e");

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerServer: [
    async ({}, use, workerInfo) => {
      const worker = await startWorkerServer(workerInfo);
      try {
        await use(worker);
      } finally {
        await workerCleanup(worker);
      }
    },
    { scope: "worker" },
  ],
  baseURL: async ({ workerServer }, use) => {
    await use(workerServer.baseURL);
  },
  e2eWorker: async ({ workerServer }, use) => {
    await use(workerServer);
  },
});

export { expect };

async function startWorkerServer(workerInfo: WorkerInfo): Promise<E2eWorker> {
  const workerRoot = path.join(e2eRoot, `worker-${workerInfo.workerIndex}`);
  const homeDir = path.join(workerRoot, "home");
  const projectDir = path.join(workerRoot, "project");
  const projectName = `orch-e2e-${workerInfo.workerIndex}`;
  const port = await getFreePort();
  const previewPortStart = 19000 + workerInfo.workerIndex * 50;
  const previewPortEnd = previewPortStart + 30;

  await fs.rm(workerRoot, { force: true, recursive: true });
  await fs.mkdir(homeDir, { recursive: true });
  await createFixtureProject(projectDir);

  const logs: string[] = [];
  const child = spawn(
    "bun",
    ["run", "cw", "start", "--host", "127.0.0.1", "--port", String(port), "--preview-port-start", String(previewPortStart), "--preview-port-end", String(previewPortEnd), "--auth", "disable"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        CODEX_WEB_AUTH: "0",
        CODEX_WEB_HOME: homeDir,
        CODEX_WEB_SKIP_EXTERNAL_IP: "1",
        FORCE_COLOR: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  collectLogs(child, logs);
  const baseURL = `http://127.0.0.1:${port}`;

  try {
    await waitForHealth(`${baseURL}/api/health`, child, logs);
  } catch (error) {
    await stopProcess(child);
    throw error;
  }

  activeChildren.set(homeDir, child);
  return { baseURL, homeDir, port, projectDir, projectName };
}

const activeChildren = new Map<string, ChildProcessWithoutNullStreams>();

async function workerCleanup(worker: E2eWorker) {
  const child = activeChildren.get(worker.homeDir);
  activeChildren.delete(worker.homeDir);
  if (child) await stopProcess(child);
  await fs.rm(path.dirname(worker.homeDir), { force: true, recursive: true });
}

async function createFixtureProject(projectDir: string) {
  await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "tools/ot"), { recursive: true });
  await fs.writeFile(path.join(projectDir, "README.md"), "# E2E Fixture\n\nIsolated project used by Playwright workers.\n");
  await fs.writeFile(path.join(projectDir, "package.json"), `${JSON.stringify({ name: "codex-web-e2e-fixture", type: "module", scripts: { dev: "bun src/index.ts" } }, null, 2)}\n`);
  await fs.writeFile(path.join(projectDir, "src/index.ts"), "export function fixture() {\n  return 'ready';\n}\n");
  await fs.writeFile(path.join(projectDir, "tools/ot/list.sh"), "#!/usr/bin/env bash\nset -euo pipefail\nprintf 'fixture\\n'\n");
  await fs.chmod(path.join(projectDir, "tools/ot/list.sh"), 0o755);

  await run("git", ["init", "-b", "main"], projectDir).catch(async () => {
    await run("git", ["init"], projectDir);
    await run("git", ["checkout", "-B", "main"], projectDir);
  });
  await run("git", ["config", "user.email", "e2e@example.test"], projectDir);
  await run("git", ["config", "user.name", "Codex Web E2E"], projectDir);
  await run("git", ["add", "."], projectDir);
  await run("git", ["commit", "-m", "Initial e2e fixture"], projectDir);
}

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a local E2E port.")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function collectLogs(child: ChildProcessWithoutNullStreams, logs: string[]) {
  const push = (chunk: Buffer) => {
    logs.push(...String(chunk).split(/\r?\n/).filter(Boolean));
    if (logs.length > 80) logs.splice(0, logs.length - 80);
  };
  child.stdout.on("data", push);
  child.stderr.on("data", push);
}

async function waitForHealth(url: string, child: ChildProcessWithoutNullStreams, logs: string[]) {
  const startedAt = Date.now();
  let exited: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  child.once("exit", (code, signal) => {
    exited = { code, signal };
  });

  while (Date.now() - startedAt < 25_000) {
    if (exited) break;
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const suffix = logs.length ? `\nLast server logs:\n${logs.join("\n")}` : "";
  if (exited) throw new Error(`E2E server exited before becoming healthy: code=${exited.code} signal=${exited.signal}${suffix}`);
  throw new Error(`Timed out waiting for E2E server health at ${url}.${suffix}`);
}

async function stopProcess(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((resolve) =>
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        resolve();
      }, 5_000),
    ),
  ]);
}
