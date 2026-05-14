import { expect, test } from "bun:test";
import { composerHighlightParts } from "@/features/codex/ComposerTextarea";
import { parseMentionSearch } from "@/features/codex/mentionUtils";
import { normalizeComposerDraft } from "@/features/codex/useComposer";

test("normalizes composer line breaks without changing user text", () => {
  expect(normalizeComposerDraft("one\r\ntwo\n")).toBe("one\ntwo\n");
});

test("tracks inline mention token ranges at the cursor", () => {
  expect(parseMentionSearch("read @PROD", 10)).toEqual({
    trigger: "@",
    query: "PROD",
    selectedIndex: 0,
    start: 5,
    end: 10,
  });
  expect(parseMentionSearch("use $codex now", 10)).toEqual({
    trigger: "$",
    query: "codex",
    selectedIndex: 0,
    start: 4,
    end: 10,
  });
});

test("splits composer text into pill-highlightable mention parts", () => {
  expect(
    composerHighlightParts("read @cmd/othelper-rg/main.go with $codex-primary-runtime", [
      { type: "file", path: "cmd/othelper-rg/main.go", isDirectory: false },
      { type: "skill", id: "codex-primary-runtime", name: "codex-primary-runtime" },
    ]),
  ).toEqual([
    { start: 0, end: 5, text: "read " },
    { start: 5, end: 29, text: "@cmd/othelper-rg/main.go", mention: { type: "file", path: "cmd/othelper-rg/main.go", isDirectory: false } },
    { start: 29, end: 35, text: " with " },
    { start: 35, end: 57, text: "$codex-primary-runtime", mention: { type: "skill", id: "codex-primary-runtime", name: "codex-primary-runtime" } },
  ]);
});
