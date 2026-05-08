import fs from "node:fs/promises";
import path from "node:path";

export function safePath(root: string, input = ".") {
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, input);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Path escape blocked");
  }
  return resolved;
}

export async function safeFsPath(root: string, input = ".") {
  const resolved = safePath(root, input);
  const realRoot = await fs.realpath(root);
  const existing = await realpathIfExists(resolved);
  if (existing) {
    assertInside(realRoot, existing);
    return resolved;
  }
  const parent = await nearestExistingParent(resolved);
  assertInside(realRoot, await fs.realpath(parent));
  return resolved;
}

async function realpathIfExists(input: string) {
  try {
    return await fs.realpath(input);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function nearestExistingParent(input: string) {
  let current = path.dirname(input);
  for (;;) {
    try {
      const stat = await fs.stat(current);
      if (stat.isDirectory()) return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const next = path.dirname(current);
    if (next === current) throw new Error("No existing parent directory");
    current = next;
  }
}

function assertInside(realRoot: string, realTarget: string) {
  if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
    throw new Error("Path escape blocked");
  }
}
