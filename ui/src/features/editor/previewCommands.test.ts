import { expect, test } from "bun:test";
import { getSuggestedPreviewCommand, sameCommand } from "@/features/editor/previewCommands";

test("suggests a Bun dev preview for package.json with a dev script", () => {
  expect(getSuggestedPreviewCommand("package.json", JSON.stringify({ scripts: { dev: "vite" } }))).toEqual(["bun", "run", "dev"]);
  expect(getSuggestedPreviewCommand("apps/web/package.json", JSON.stringify({ scripts: { dev: "vite" } }))).toEqual(["bun", "run", "dev"]);
});

test("does not suggest a package preview without a dev script", () => {
  expect(getSuggestedPreviewCommand("package.json", JSON.stringify({ scripts: { build: "vite build" } }))).toBeUndefined();
  expect(getSuggestedPreviewCommand("src/app.ts", "")).toBeUndefined();
});

test("keeps the existing forgiving package.json preview fallback", () => {
  expect(getSuggestedPreviewCommand("package.json", "{")).toEqual(["bun", "run", "dev"]);
});

test("suggests an eval-based HTML preview command", () => {
  const command = getSuggestedPreviewCommand("public/index.html", "");
  expect(command?.slice(0, 2)).toEqual(["bun", "--eval"]);
  expect(command?.[2]).toContain(`const target = "public/index.html";`);
});

test("compares commands by exact parts", () => {
  expect(sameCommand(["bun", "run", "dev"], ["bun", "run", "dev"])).toBe(true);
  expect(sameCommand(["bun", "run", "dev"], ["bun", "dev"])).toBe(false);
});
