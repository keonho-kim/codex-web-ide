export function proxyHttpRequest(req: Request, internalPort: number) {
  const url = new URL(req.url);
  url.protocol = "http:";
  url.hostname = "127.0.0.1";
  url.port = String(internalPort);
  const headers = new Headers(req.headers);
  headers.set("host", `127.0.0.1:${internalPort}`);
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
