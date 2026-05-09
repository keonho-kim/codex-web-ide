export type BunServer = {
  stop(force?: boolean): void;
};

export type BunServe = (options: {
  hostname: string;
  port: number;
  idleTimeout?: number;
  fetch(req: Request, server: BunUpgradeServer): Response | Promise<Response> | undefined;
  websocket: {
    data: PreviewSocketData;
    open(ws: ServerSocket): void;
    message(ws: ServerSocket, message: string | ArrayBuffer | Uint8Array): void;
    close(ws: ServerSocket): void;
  };
}) => BunServer;

export type BunUpgradeServer = {
  upgrade(req: Request, options: { data: PreviewSocketData }): boolean;
  requestIP(req: Request): { address: string; port: number } | null;
  timeout?(req: Request, seconds: number): void;
};

export type ServerSocket = {
  data: PreviewSocketData;
  readyState: number;
  send(message: string | ArrayBuffer | Uint8Array): number;
  close(code?: number, reason?: string): void;
};

export type PreviewSocketData = {
  target: string;
  upstream?: WebSocket;
  upstreamOpen?: boolean;
  queuedMessages?: Array<string | ArrayBuffer | Uint8Array>;
};
