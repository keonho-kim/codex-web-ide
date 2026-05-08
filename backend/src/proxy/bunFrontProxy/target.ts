import type { AppServices } from "../../api/context";

export function previewWebSocketTarget(req: Request, { commands }: AppServices) {
  const url = new URL(req.url);
  const preview = previewFromPath(url.pathname) ?? previewFromReferer(req.headers.get("referer"));
  if (!preview) return null;
  const target = commands.getPreviewTarget(preview.sessionId, preview.previewId);
  if (!target) return null;
  return toUpstreamWebSocketUrl(target, url, preview);
}

function previewFromPath(pathname: string) {
  const match = pathname.match(/^\/preview\/([^/]+)\/([^/]+)(?:\/|$)/);
  return match ? { sessionId: match[1], previewId: match[2], prefix: `/preview/${match[1]}/${match[2]}` } : null;
}

function previewFromReferer(referer: string | null) {
  if (!referer) return null;
  try {
    return previewFromPath(new URL(referer).pathname);
  } catch {
    return previewFromPath(referer);
  }
}

function toUpstreamWebSocketUrl(target: string, requestUrl: URL, preview: { prefix: string }) {
  const upstream = new URL(target);
  upstream.protocol = upstream.protocol === "https:" ? "wss:" : "ws:";
  upstream.pathname = requestUrl.pathname.startsWith(preview.prefix)
    ? requestUrl.pathname.slice(preview.prefix.length) || "/"
    : requestUrl.pathname;
  upstream.search = requestUrl.search;
  return upstream.toString();
}
