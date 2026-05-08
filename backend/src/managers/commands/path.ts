import { stat } from "node:fs/promises";
import path from "node:path";
import { safeFsPath } from "../files/path";

export async function resolveCommandCwd(sessionCwd: string, input?: string) {
  const cwd = input ? await safeFsPath(sessionCwd, path.isAbsolute(input) ? path.relative(sessionCwd, input) : input) : await safeFsPath(sessionCwd);
  const cwdStat = await stat(cwd);
  if (!cwdStat.isDirectory()) throw new Error("Command cwd must be a directory");
  return cwd;
}
