export const ignoredPathPattern = /(^|[/\\])(\.git|node_modules|dist|build|target|\.next|\.venv)([/\\]|$)/;

export function isVisibleFileName(name: string) {
  return !name.startsWith(".") || [".agents", ".github"].includes(name);
}
