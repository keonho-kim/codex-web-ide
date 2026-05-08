import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readPidFile } from "./pidFile";

export async function api<T>(pathName: string, options: { method?: string; body?: unknown } = {}) {
  let response: Response;
  try {
    const token = await authToken();
    response = await fetch(`${await serverBaseUrl()}${pathName}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "x-codex-web-token": token } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Codex Web IDE is not running. Start it with `cw start` before using managed commands.");
  }
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

export async function serverBaseUrl() {
  const configuredPort = process.env.CODEX_WEB_PORT;
  const pid = await readPidFile();
  const port = Number(configuredPort || pid?.port || 17321);
  return `http://127.0.0.1:${port}`;
}

async function authToken() {
  if (process.env.CODEX_WEB_TOKEN) return process.env.CODEX_WEB_TOKEN;
  try {
    const config = JSON.parse(await fs.readFile(path.join(codexWebHome(), "config.json"), "utf8")) as { auth?: { token?: string } };
    return config.auth?.token || null;
  } catch {
    return null;
  }
}

function codexWebHome() {
  return process.env.CODEX_WEB_HOME || path.join(os.homedir(), ".codex-web");
}
