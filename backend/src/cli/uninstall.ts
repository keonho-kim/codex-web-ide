import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageName = "codex-web-ide";
const launcherNames = ["cw", "codex-web"] as const;

type UninstallOptions = {
  currentModulePath?: string;
  globalBinDir?: string;
  installRoot?: string;
};

type LauncherRemoval = {
  path: string;
  removed: boolean;
  reason?: string;
};

export type UninstallPlan = {
  installDir: string;
  installRoot: string;
  globalBinDir: string;
  launchers: LauncherRemoval[];
};

export async function uninstall(input: string[] = []) {
  if (input.length > 0) throw new Error(`Unknown uninstall option: ${input[0]}`);
  const plan = await uninstallCurrentInstallation();
  console.log(`Removed ${packageName} from ${plan.installDir}`);
  for (const launcher of plan.launchers) {
    if (launcher.removed) console.log(`Removed launcher ${launcher.path}`);
    else console.log(`Skipped launcher ${launcher.path}: ${launcher.reason}`);
  }
}

export async function uninstallCurrentInstallation(options: UninstallOptions = {}): Promise<UninstallPlan> {
  const installRoot = path.resolve(options.installRoot ?? process.env.CW_INSTALL_ROOT ?? path.join(os.homedir(), ".local", "share", packageName));
  const currentModulePath = options.currentModulePath ?? fileURLToPath(import.meta.url);
  const installDir = resolveInstallDir(currentModulePath);
  assertReleaseInstallDir(installDir, installRoot);
  const globalBinDir = path.resolve(options.globalBinDir ?? (await resolveGlobalBinDir()));
  const launchers = await removeLaunchers(globalBinDir, installDir);
  await fs.rm(installDir, { force: true, recursive: true });
  await removeEmptyDirectory(installRoot);
  return { installDir, installRoot, globalBinDir, launchers };
}

export function resolveInstallDir(currentModulePath: string) {
  return path.resolve(path.dirname(currentModulePath), "..", "..", "..");
}

function assertReleaseInstallDir(installDir: string, installRoot: string) {
  const relative = path.relative(installRoot, installDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) {
    throw new Error(`Refusing to uninstall from ${installDir}. Expected a release install under ${installRoot}.`);
  }
}

async function resolveGlobalBinDir() {
  try {
    const { stdout } = await execFileAsync("bun", ["pm", "bin", "-g"], { timeout: 5_000 });
    const binDir = stdout.trim();
    if (binDir) return binDir;
  } catch {
    // Fall through to Bun's default user bin directory.
  }
  return path.join(os.homedir(), ".bun", "bin");
}

async function removeLaunchers(globalBinDir: string, installDir: string) {
  return Promise.all(launcherNames.map((name) => removeLauncher(path.join(globalBinDir, name), installDir)));
}

async function removeLauncher(launcherPath: string, installDir: string): Promise<LauncherRemoval> {
  const removable = await isManagedLauncher(launcherPath, installDir);
  if (!removable.ok) return { path: launcherPath, removed: false, reason: removable.reason };
  await fs.rm(launcherPath, { force: true });
  return { path: launcherPath, removed: true };
}

async function isManagedLauncher(launcherPath: string, installDir: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  let stat;
  try {
    stat = await fs.lstat(launcherPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ok: false, reason: "not found" };
    throw error;
  }
  if (stat.isSymbolicLink()) {
    const target = await fs.readlink(launcherPath);
    const resolved = path.resolve(path.dirname(launcherPath), target);
    return isInside(resolved, installDir) ? { ok: true } : { ok: false, reason: "not managed by this installation" };
  }
  if (!stat.isFile()) return { ok: false, reason: "not a regular file" };
  const content = await fs.readFile(launcherPath, "utf8");
  return content.includes(installDir) ? { ok: true } : { ok: false, reason: "not managed by this installation" };
}

function isInside(target: string, root: string) {
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function removeEmptyDirectory(directory: string) {
  try {
    await fs.rmdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY" && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
