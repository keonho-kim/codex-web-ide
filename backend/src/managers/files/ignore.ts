import path from "node:path";
import { isForbiddenProjectEntry } from "@backend/managers/projects/pathPolicy";

export const ignoredPathPattern = /(^|[/\\])(\.git|node_modules|dist|build|target|\.next|\.venv)([/\\]|$)/;

export function isIgnoredPath(input: string) {
  return ignoredPathPattern.test(input) || isForbiddenProjectEntry(path.resolve(input));
}

export function isVisibleFileName(name: string) {
  return !name.startsWith(".") || [".agents", ".github"].includes(name);
}
