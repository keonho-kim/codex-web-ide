import type { Express, Request } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { AppServices } from "@backend/api/context";

export function registerPreviewProxy(app: Express, { commands }: AppServices) {
  const previewAssetProxy = createProxyMiddleware({
    target: "http://127.0.0.1:9",
    changeOrigin: true,
    ws: true,
    router: (req) => (req as Request).res?.locals.previewTarget || "http://127.0.0.1:9",
  });

  app.use(
    "/preview/:sessionId/:previewId",
    createProxyMiddleware({
      target: "http://127.0.0.1:9",
      changeOrigin: true,
      ws: true,
      router: (req) => {
        const expressReq = req as Request;
        const sessionId = expressReq.params?.sessionId;
        const previewId = expressReq.params?.previewId;
        return typeof sessionId === "string" && typeof previewId === "string"
          ? commands.getPreviewTarget(sessionId, previewId) || "http://127.0.0.1:9"
          : "http://127.0.0.1:9";
      },
      pathRewrite: (_path, req) => {
        const expressReq = req as Request;
        const sessionId = expressReq.params?.sessionId;
        const previewId = expressReq.params?.previewId;
        if (typeof sessionId !== "string" || typeof previewId !== "string") return "/";
        return expressReq.originalUrl.replace(`/preview/${sessionId}/${previewId}`, "") || "/";
      },
    }),
  );
  app.use((req, res, next) => {
    const preview = previewFromReferer(req);
    if (!preview) {
      next();
      return;
    }
    const target = commands.getPreviewTarget(preview.sessionId, preview.previewId);
    if (!target) {
      next();
      return;
    }
    res.locals.previewTarget = target;
    previewAssetProxy(req, res, next);
  });
}

function previewFromReferer(req: Request) {
  const referer = req.header("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const match = url.pathname.match(/^\/preview\/([^/]+)\/([^/]+)(?:\/|$)/);
    return match ? { sessionId: match[1], previewId: match[2] } : null;
  } catch {
    const match = referer.match(/\/preview\/([^/]+)\/([^/]+)(?:\/|$)/);
    return match ? { sessionId: match[1], previewId: match[2] } : null;
  }
}
