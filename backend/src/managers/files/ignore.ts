export const ignoredPathPattern = /(^|[/\\])(\.git[/\\]objects|node_modules|dist|build|target|\.next|\.venv)([/\\]|$)/;

export function isVisibleFileName(name: string) {
  return !name.startsWith(".") || [".agents", ".github"].includes(name);
}
