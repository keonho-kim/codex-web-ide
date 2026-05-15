import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ClipboardEvent, type CompositionEvent, type FormEvent, type KeyboardEvent } from "react";
import type { ComposerMention } from "@/lib/types";
import { cn } from "@/lib/classes";
import { mentionLabel } from "@/features/codex/mentionUtils";

export type ComposerInputHandle = {
  focusAt(index?: number): void;
  selectionStart(): number;
};

export const ComposerTextarea = forwardRef<
  ComposerInputHandle,
  {
    mentions: ComposerMention[];
    readOnly: boolean;
    value: string;
    onChange(value: string, cursorIndex: number): void;
    onKeyDown(event: KeyboardEvent<HTMLDivElement>): void;
  }
>(function ComposerTextarea({ mentions, onChange, onKeyDown, readOnly, value }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const pendingCursorRef = useRef<number | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focusAt(index = value.length) {
        const editor = editorRef.current;
        if (!editor) return;
        pendingCursorRef.current = index;
        editor.focus();
        setSelectionOffset(editor, index);
      },
      selectionStart() {
        const editor = editorRef.current;
        return editor ? getSelectionOffset(editor) : value.length;
      },
    }),
    [value.length],
  );

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (composingRef.current) return;
    const shouldRestoreSelection = document.activeElement === editor;
    const cursor = pendingCursorRef.current ?? (shouldRestoreSelection ? getSelectionOffset(editor) : null);
    const didRender = renderEditableContentIfNeeded(editor, value, mentions);
    pendingCursorRef.current = null;
    if (didRender && cursor !== null && shouldRestoreSelection) setSelectionOffset(editor, Math.min(cursor, value.length));
  }, [mentions, value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = readEditableText(editor);
    const cursor = getSelectionOffset(editor);
    onChange(text, cursor);
  };

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (composingRef.current || nativeEvent.isComposing || isCompositionInput(nativeEvent)) return;
    emitChange();
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = (_event: CompositionEvent<HTMLDivElement>) => {
    composingRef.current = false;
    emitChange();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown(event);
    if (event.defaultPrevented || event.key !== "Enter" || !event.shiftKey) return;
    event.preventDefault();
    insertTextAtSelection("\n");
    emitChange();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    insertTextAtSelection(event.clipboardData.getData("text/plain"));
    emitChange();
  };

  return (
    <div className="relative bg-canvas">
      <div
        ref={editorRef}
        aria-label="Composer"
        className="max-h-[180px] min-h-[88px] w-full overflow-y-auto whitespace-pre-wrap break-words bg-canvas px-2.5 py-2 text-sm leading-6 text-ink outline-none max-[700px]:min-h-[76px]"
        contentEditable={!readOnly}
        role="textbox"
        spellCheck={false}
        suppressContentEditableWarning
        onCompositionEnd={handleCompositionEnd}
        onCompositionStart={handleCompositionStart}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
    </div>
  );
});

export type ComposerHighlightPart = {
  end: number;
  mention?: ComposerMention;
  start: number;
  text: string;
};

export function composerHighlightParts(value: string, mentions: ComposerMention[]): ComposerHighlightPart[] {
  if (!value || mentions.length === 0) return value ? [{ start: 0, end: value.length, text: value }] : [];
  const ranges = mentions
    .flatMap((mention) => findMentionRanges(value, mention))
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const parts: ComposerHighlightPart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) parts.push({ start: cursor, end: range.start, text: value.slice(cursor, range.start) });
    parts.push({ ...range, text: value.slice(range.start, range.end) });
    cursor = range.end;
  }
  if (cursor < value.length) parts.push({ start: cursor, end: value.length, text: value.slice(cursor) });
  return parts;
}

function findMentionRanges(value: string, mention: ComposerMention): Array<Omit<ComposerHighlightPart, "text">> {
  const label = mentionLabel(mention);
  const ranges: Array<Omit<ComposerHighlightPart, "text">> = [];
  let start = value.indexOf(label);
  while (start !== -1) {
    const end = start + label.length;
    if (isMentionBoundary(value[start - 1]) && isMentionBoundary(value[end])) ranges.push({ start, end, mention });
    start = value.indexOf(label, end);
  }
  return ranges;
}

function renderEditableContentIfNeeded(root: HTMLElement, value: string, mentions: ComposerMention[]) {
  if (readEditableText(root) === value && mentionLabelsIn(root).join("\0") === expectedMentionLabels(value, mentions).join("\0")) return false;
  const children = composerHighlightParts(value, mentions).map((part) => {
    if (!part.mention) return document.createTextNode(part.text);
    const pill = document.createElement("span");
    pill.className = cn(
      "mx-0.5 inline-flex max-w-full items-center rounded-full border px-1.5 py-0 align-baseline text-[0.92em] leading-5",
      part.mention.type === "file" ? "border-sky-200 bg-sky-100 text-sky-800" : "border-rose-200 bg-rose-100 text-rose-800",
    );
    pill.contentEditable = "false";
    pill.dataset.mentionLabel = part.text;
    pill.textContent = part.text;
    return pill;
  });
  root.replaceChildren(...(children.length > 0 ? children : [document.createElement("br")]));
  return true;
}

function expectedMentionLabels(value: string, mentions: ComposerMention[]) {
  return composerHighlightParts(value, mentions)
    .filter((part) => part.mention)
    .map((part) => part.text);
}

function mentionLabelsIn(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-mention-label]")).map((node) => node.dataset.mentionLabel ?? "");
}

function readEditableText(root: HTMLElement) {
  if (root.childNodes.length === 1 && root.firstChild instanceof HTMLBRElement) return "";
  let text = "";
  const read = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const mentionLabel = node.dataset.mentionLabel;
    if (mentionLabel !== undefined) {
      text += mentionLabel;
      return;
    }
    if (node.tagName === "BR") {
      text += "\n";
      return;
    }
    node.childNodes.forEach(read);
  };
  root.childNodes.forEach(read);
  return text;
}

function getSelectionOffset(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return readEditableText(root).length;
  const range = selection.getRangeAt(0);
  const target = range.startContainer;
  const targetOffset = range.startOffset;
  let offset = 0;
  let found = false;

  const walk = (node: Node) => {
    if (found) return;
    if (node === target) {
      offset += offsetWithinNode(node, targetOffset);
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0;
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const mentionLabel = node.dataset.mentionLabel;
    if (mentionLabel !== undefined) {
      offset += mentionLabel.length;
      return;
    }
    node.childNodes.forEach(walk);
  };

  walk(root);
  return offset;
}

function offsetWithinNode(node: Node, offset: number) {
  if (node.nodeType === Node.TEXT_NODE) return offset;
  if (!(node instanceof HTMLElement)) return 0;
  let total = 0;
  Array.from(node.childNodes)
    .slice(0, offset)
    .forEach((child) => {
      total += nodeTextLength(child);
    });
  return total;
}

function nodeTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if (!(node instanceof HTMLElement)) return 0;
  const mentionLabel = node.dataset.mentionLabel;
  if (mentionLabel !== undefined) return mentionLabel.length;
  if (node.tagName === "BR") return 1;
  return Array.from(node.childNodes).reduce((total, child) => total + nodeTextLength(child), 0);
}

function setSelectionOffset(root: HTMLElement, targetOffset: number) {
  const range = document.createRange();
  const selection = window.getSelection();
  let offset = Math.max(0, targetOffset);
  let placed = false;

  const place = (node: Node) => {
    if (placed) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (offset <= length) {
        range.setStart(node, offset);
        placed = true;
      } else {
        offset -= length;
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const mentionLabel = node.dataset.mentionLabel;
    if (mentionLabel !== undefined) {
      const parent = node.parentNode;
      if (!parent) return;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);
      if (offset <= mentionLabel.length) {
        range.setStart(parent, offset < mentionLabel.length ? index : index + 1);
        placed = true;
      } else {
        offset -= mentionLabel.length;
      }
      return;
    }
    node.childNodes.forEach(place);
  };

  place(root);
  if (!placed) range.selectNodeContents(root), range.collapse(false);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function insertTextAtSelection(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function isCompositionInput(event: InputEvent) {
  return event.inputType === "insertCompositionText" || event.inputType === "deleteCompositionText";
}

function isMentionBoundary(value: string | undefined) {
  return value === undefined || /\s/.test(value);
}
