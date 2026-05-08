import fs from "node:fs/promises";
import path from "node:path";
import { JsonStore } from "../managers/storage";
import { WorkspaceManager } from "../managers/workspaceManager";

const runtimeAgents = `# Codex Web Runtime Policy

This project is managed by Codex Web.

## Commands

Do not run long-running commands directly.

Use:

- \`cw job <command...>\` for commands expected to finish.
- \`cw preview <command...>\` for browser-viewable web apps.
- \`cw service <command...>\` for long-running background processes.

Examples:

- \`cw job bun run build\`
- \`cw job bun test\`
- \`cw job go test ./...\`
- \`cw job cargo build\`
- \`cw job python -m pytest\`

- \`cw preview bun run dev\`
- \`cw preview bun run preview\`
- \`cw preview uvicorn main:app\`
- \`cw preview go run ./cmd/web\`
- \`cw preview cargo run --bin web\`

- \`cw service python bot.py\`
- \`cw service go run ./cmd/worker\`

## Git

Do not run destructive Git commands without explicit user approval.

Require approval for:

- reset --hard
- clean -fd
- force push
- branch delete
- rebase

## Preview

Preview processes must be started through \`cw preview\` so the UI can track ports, logs, process IDs, and iframe URLs.
`;

export async function initProject(input: string[]) {
  const cwd = path.resolve(input[0] || process.cwd());
  const store = new JsonStore();
  await store.ensure();
  const workspace = new WorkspaceManager(store);
  const project = await workspace.addProject({ cwd });
  await workspace.openProject(project.id);
  const agentsCreated = await ensureRuntimeAgentsFile(cwd);
  console.log(`Initialized project: ${project.name}`);
  console.log(project.cwd);
  console.log(agentsCreated ? "Created AGENTS.md with Codex Web runtime policy." : "AGENTS.md already exists; left it unchanged.");
}

async function ensureRuntimeAgentsFile(cwd: string) {
  const file = path.join(cwd, "AGENTS.md");
  try {
    await fs.writeFile(file, runtimeAgents, { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}
