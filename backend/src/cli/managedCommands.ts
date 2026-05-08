import path from "node:path";
import { api } from "./apiClient";
import type { Job, PreviewInstance, ServiceInstance, Session } from "../shared/types";

export type ManagedCommandKind = "job" | "preview" | "service";

export async function runManagedCommand(kind: ManagedCommandKind, commandArgs: string[]) {
  const approvedDangerous = commandArgs.includes("--approve-dangerous");
  const command = commandArgs.filter((arg) => arg !== "--approve-dangerous");
  if (command.length === 0) {
    console.error(`Usage: cw ${kind} <command...>`);
    process.exit(1);
  }
  const session = await ensureSessionForCwd();
  const result = await api<Job | PreviewInstance | ServiceInstance>(`/api/sessions/${session.id}/commands/${kind}`, {
    method: "POST",
    body: { command, cwd: process.cwd(), approvedDangerous },
  });

  if (kind === "job") {
    const exitCode = await followJob(session.id, (result as Job).id);
    process.exit(exitCode);
  }

  console.log(JSON.stringify(result, null, 2));
}

async function ensureSessionForCwd() {
  const cwd = path.resolve(process.cwd());
  const sessions = await api<Session[]>("/api/sessions");
  const existing = sessions.find((session) => session.cwd === cwd);
  if (existing) return existing;
  return api<Session>("/api/sessions", { method: "POST", body: { cwd } });
}

async function followJob(sessionId: string, jobId: string) {
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
