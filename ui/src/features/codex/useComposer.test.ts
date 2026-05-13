import { expect, test } from "bun:test";
import { editorText, textDocument } from "@/features/codex/useComposer";

test("builds a Tiptap document that preserves composer line breaks", () => {
  expect(textDocument("one\ntwo\n")).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "one" }] },
      { type: "paragraph", content: [{ type: "text", text: "two" }] },
      { type: "paragraph" },
    ],
  });
});

test("reads Tiptap editor text with newline block separators", () => {
  const calls: Array<{ blockSeparator?: string }> = [];
  const text = editorText({
    getText(options) {
      calls.push(options ?? {});
      return "one\ntwo";
    },
  });

  expect(text).toBe("one\ntwo");
  expect(calls).toEqual([{ blockSeparator: "\n" }]);
});
