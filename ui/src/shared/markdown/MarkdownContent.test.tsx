import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";
import { MarkdownContent } from "@/shared/markdown/MarkdownContent";

test("renders markdown, sanitized html, and katex content", () => {
  const html = renderToStaticMarkup(<MarkdownContent content={"# Title\n\n<strong>bold</strong>\n\n<script>alert(1)</script>\n\n$E=mc^2$"} />);

  expect(html).toContain("<h1");
  expect(html).toContain("<strong>bold</strong>");
  expect(html).not.toContain("<script>");
  expect(html).toContain("katex");
});
