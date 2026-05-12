import { isHtmlPath } from "@/features/editor/documentTypes";

const PACKAGE_JSON_PATH = /(^|\/)package\.json$/i;

export function getSuggestedPreviewCommand(path: string | undefined, content: string) {
  if (!path) return undefined;
  if (isHtmlPath(path)) return htmlPreviewCommand(path);
  if (!PACKAGE_JSON_PATH.test(path)) return undefined;
  try {
    const parsed = JSON.parse(content) as { scripts?: Record<string, unknown> };
    if (typeof parsed.scripts?.dev !== "string") return undefined;
  } catch {
    return ["bun", "run", "dev"];
  }
  return ["bun", "run", "dev"];
}

export function sameCommand(left: string[], right: string[]) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function htmlPreviewCommand(path: string) {
  const script = [
    `const path = require("node:path");`,
    `const root = process.cwd();`,
    `const target = ${JSON.stringify(path)};`,
    `const port = Number(process.env.PORT || 3000);`,
    `Bun.serve({`,
    `  hostname: "127.0.0.1",`,
    `  port,`,
    `  async fetch(req) {`,
    `    const url = new URL(req.url);`,
    `    const rel = decodeURIComponent(url.pathname.slice(1)) || target;`,
    `    const full = path.resolve(root, rel);`,
    `    if (full !== root && !full.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });`,
    `    return new Response(Bun.file(full));`,
    `  },`,
    `});`,
    `console.log("HTML preview listening on", port);`,
  ].join("\n");
  return ["bun", "--eval", script];
}
