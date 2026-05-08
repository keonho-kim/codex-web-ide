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
  const configuredHost = process.env.CODEX_WEB_HOST;
  const configuredPort = process.env.CODEX_WEB_PORT;
  const config = await readConfig();
  const pid = await readPidFile();
  const host = connectionHost(configuredHost || pid?.host || config.host || "127.0.0.1");
  const port = Number(configuredPort || pid?.port || config.port || 17321);
  return `http://${host}:${port}`;
}

async function authToken() {
  if (process.env.CODEX_WEB_TOKEN) return process.env.CODEX_WEB_TOKEN;
  try {
    const config = await readConfig();
    return config.auth?.token || null;
  } catch {
    return null;
  }
}

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(path.join(codexWebHome(), "config.json"), "utf8")) as { host?: string; port?: number; auth?: { token?: string } };
  } catch {
    return {};
  }
}

function connectionHost(host: string) {
  if (host === "0.0.0.0" || host === "::") return "127.0.0.1";
  return host;
}

function codexWebHome() {
  return process.env.CODEX_WEB_HOME || path.join(os.homedir(), ".codex-web");
}
