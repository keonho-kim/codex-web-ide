import { expect, test } from "bun:test";
import { isHtmlPath, isMarkdownPath, isPreviewablePath } from "@/features/editor/documentTypes";

test("detects previewable markdown and html files", () => {
  expect(isMarkdownPath("README.md")).toBe(true);
  expect(isMarkdownPath("notes.markdown")).toBe(true);
  expect(isMarkdownPath("page.html")).toBe(false);
  expect(isHtmlPath("page.html")).toBe(true);
  expect(isHtmlPath("fragment.htm")).toBe(true);
  expect(isPreviewablePath("README.md")).toBe(true);
  expect(isPreviewablePath("page.html")).toBe(true);
  expect(isPreviewablePath("src/app.ts")).toBe(false);
});
