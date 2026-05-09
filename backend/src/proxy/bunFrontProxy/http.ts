import type { BunUpgradeServer } from "./types";

export function proxyHttpRequest(req: Request, internalPort: number, server: BunUpgradeServer) {
  const url = new URL(req.url);
  url.protocol = "http:";
  url.hostname = "127.0.0.1";
  url.port = String(internalPort);
  const headers = new Headers(req.headers);
  headers.set("x-forwarded-host", headers.get("host") || url.host);
  headers.set("x-forwarded-proto", new URL(req.url).protocol.replace(":", ""));
  headers.set("host", `127.0.0.1:${internalPort}`);
  setClientAddressHeaders(headers, req, server);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    redirect: "manual",
  });
}

export function isWebSocketRequest(req: Request) {
  return req.headers.get("upgrade")?.toLowerCase() === "websocket";
}

export function clientAddress(req: Request, server: BunUpgradeServer) {
  return server.requestIP(req)?.address;
}

export function setClientAddressHeaders(headers: Headers, req: Request, server: BunUpgradeServer) {
  const address = clientAddress(req, server);
  if (!address) return;
  headers.set("x-forwarded-for", address);
  headers.set("x-real-ip", address);
}
