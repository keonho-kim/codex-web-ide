import { access } from "node:fs/promises";
import path from "node:path";
import { safePath } from "../fileManager";

export async function resolveCommandCwd(sessionCwd: string, input?: string) {
  const cwd = input ? safePath(sessionCwd, path.isAbsolute(input) ? path.relative(sessionCwd, input) : input) : sessionCwd;
  await access(cwd);
  return cwd;
}
