import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { expandUserPath } from "../files/path";

const FORBIDDEN_ROOTS = ["/dev", "/proc", "/sys", "/run", "/System", "/Network"];
const FORBIDDEN_EXACT_ROOTS = ["/Volumes"];

export async function resolveProjectRoot(input: string) {
  try {
    const requested = path.resolve(expandUserPath(input));
    const real = await fsp.realpath(requested);
    const stat = await fsp.stat(real);
    if (!stat.isDirectory()) throw unsupportedProjectPath("path is not a directory");
    await fsp.access(real, fs.constants.R_OK | fs.constants.X_OK);
    assertSupportedProjectRoot(real);
    return real;
  } catch (error) {
    throw normalizeProjectPathError(error);
  }
}

export function assertSupportedProjectRootSync(input: string) {
  try {
    const real = fs.realpathSync(path.resolve(expandUserPath(input)));
    const stat = fs.statSync(real);
    if (!stat.isDirectory()) throw unsupportedProjectPath("path is not a directory");
    fs.accessSync(real, fs.constants.R_OK | fs.constants.X_OK);
    assertSupportedProjectRoot(real);
    return real;
  } catch (error) {
    throw normalizeProjectPathError(error);
  }
}

export function assertSupportedProjectRoot(realPath: string) {
  if (process.platform === "win32") return;
  const normalized = path.resolve(realPath);
  if (normalized === path.parse(normalized).root) throw unsupportedProjectPath("filesystem root is not supported");
  if (FORBIDDEN_EXACT_ROOTS.some((root) => normalized === path.resolve(root))) throw unsupportedProjectPath("system directory is not supported");
  if (FORBIDDEN_ROOTS.some((root) => isInsideRoot(normalized, path.resolve(root)))) throw unsupportedProjectPath("system directory is not supported");
}

export function isForbiddenProjectEntry(input: string) {
  if (process.platform === "win32") return false;
  const normalized = path.resolve(input);
  return (
    normalized === path.parse(normalized).root ||
    FORBIDDEN_EXACT_ROOTS.some((root) => normalized === path.resolve(root)) ||
    FORBIDDEN_ROOTS.some((root) => isInsideRoot(normalized, path.resolve(root)))
  );
}

export function isInsideRoot(candidate: string, root: string) {
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(normalizedRoot + path.sep);
}

function unsupportedProjectPath(reason: string) {
  return new Error(`Project path is not a supported project directory: ${reason}`);
}

function normalizeProjectPathError(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Project path is not a supported project directory:")) return error;
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  if (code === "ENOENT") return unsupportedProjectPath("path does not exist");
  if (code === "EACCES" || code === "EPERM") return unsupportedProjectPath("path is not accessible");
  return error instanceof Error ? unsupportedProjectPath(error.message) : unsupportedProjectPath(String(error));
}
