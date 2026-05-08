import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type PidRecord = {
  pid: number;
  host?: string;
  port: number;
  startedAt: number;
};

export function pidFile() {
  return path.join(process.env.CODEX_WEB_HOME || path.join(os.homedir(), ".codex-web"), "codex-web.pid");
}

export async function writePidFile(port: number, host?: string) {
  await fs.mkdir(path.dirname(pidFile()), { recursive: true });
  await fs.writeFile(pidFile(), JSON.stringify({ pid: process.pid, host, port, startedAt: Date.now() }, null, 2));
}

export async function readPidFile() {
  try {
    return JSON.parse(await fs.readFile(pidFile(), "utf8")) as PidRecord;
  } catch {
    return null;
  }
}

export async function removePidFile() {
  await fs.rm(pidFile(), { force: true });
}
