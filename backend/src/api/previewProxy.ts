import type { Express, Request } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { AppServices } from "./context";

export function registerPreviewProxy(app: Express, { commands }: AppServices) {
  app.use(
    "/preview/:sessionId/:previewId",
    createProxyMiddleware({
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
}
