export function isPreviewablePath(path?: string) {
  return Boolean(path && (isMarkdownPath(path) || isHtmlPath(path)));
}

export function isMarkdownPath(path: string) {
  return /\.(md|markdown|mdx)$/i.test(path);
}

export function isHtmlPath(path: string) {
  return /\.(html|htm)$/i.test(path);
}
