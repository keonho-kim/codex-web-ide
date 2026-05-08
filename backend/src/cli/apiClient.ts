import { readPidFile } from "./pidFile";

export async function api<T>(pathName: string, options: { method?: string; body?: unknown } = {}) {
  let response: Response;
  try {
    response = await fetch(`${await serverBaseUrl()}${pathName}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
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
