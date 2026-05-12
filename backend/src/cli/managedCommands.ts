import path from "node:path";
import fs from "node:fs/promises";
import { api as defaultApi } from "@backend/cli/apiClient";
import type { Job, PreviewInstance, ServiceInstance, Session } from "@backend/shared/types";

export type ManagedCommandKind = "job" | "preview" | "service";
type ApiClient = <T>(pathName: string, options?: { method?: string; body?: unknown }) => Promise<T>;

export async function runManagedCommand(kind: ManagedCommandKind, commandArgs: string[]) {
  const result = await executeManagedCommand(kind, commandArgs);
  if (result.output) console.log(result.output);
  if (result.error) console.error(result.error);
  if (result.exitCode !== undefined) process.exit(result.exitCode);
}

export async function executeManagedCommand(kind: ManagedCommandKind, commandArgs: string[], api: ApiClient = defaultApi) {
  const approvedDangerous = commandArgs.includes("--approve-dangerous");
  const command = commandArgs.filter((arg) => arg !== "--approve-dangerous");
  if (command.length === 0) {
    return { exitCode: 1, error: `Usage: cw ${kind} <command...>` };
  }
  const cwd = await currentWorkingDirectory();
  const session = await ensureSessionForCwd(api, cwd);
  const result = await api<Job | PreviewInstance | ServiceInstance>(`/api/sessions/${session.id}/commands/${kind}`, {
    method: "POST",
    body: { command, cwd, approvedDangerous },
  });

  if (kind === "job") {
    return { exitCode: await followJob(session.id, (result as Job).id, api) };
  }

  return { output: JSON.stringify(result, null, 2) };
}

async function ensureSessionForCwd(api: ApiClient, cwd: string) {
  const sessions = await api<Session[]>("/api/sessions");
  const existing = sessions.find((session) => session.cwd === cwd);
  if (existing) return existing;
  return api<Session>("/api/sessions", { method: "POST", body: { cwd } });
}

async function currentWorkingDirectory() {
  return fs.realpath(path.resolve(process.cwd()));
}

async function followJob(sessionId: string, jobId: string, api: ApiClient) {
  let stdoutOffset = 0;
  let stderrOffset = 0;
  for (;;) {
    const job = await api<Job>(`/api/sessions/${sessionId}/jobs/${jobId}`);
    const stdout = job.stdout.slice(stdoutOffset).join("");
    const stderr = job.stderr.slice(stderrOffset).join("");
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    stdoutOffset = job.stdout.length;
    stderrOffset = job.stderr.length;
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return job.exitCode ?? (job.status === "succeeded" ? 0 : 1);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
