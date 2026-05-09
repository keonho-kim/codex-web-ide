import type { AppServices } from "../../api/context";

export type BunServer = {
  stop(force?: boolean): void;
};

export type BunServe = (options: {
  hostname: string;
  port: number;
  idleTimeout?: number;
  fetch(req: Request, server: BunUpgradeServer): Response | Promise<Response> | undefined;
  websocket: {
    data: SocketData;
    open(ws: ServerSocket): void;
    message(ws: ServerSocket, message: string | ArrayBuffer | Uint8Array): void;
    close(ws: ServerSocket): void;
  };
}) => BunServer;

export type BunUpgradeServer = {
  upgrade(req: Request, options: { data: SocketData }): boolean;
  requestIP(req: Request): { address: string; port: number } | null;
  timeout?(req: Request, seconds: number): void;
};

export type ServerSocket = {
  data: SocketData;
  readyState: number;
  send(message: string | ArrayBuffer | Uint8Array): number;
  close(code?: number, reason?: string): void;
};

export type PreviewSocketData = {
  kind: "preview";
  target: string;
  upstream?: WebSocket;
  upstreamOpen?: boolean;
  queuedMessages?: Array<string | ArrayBuffer | Uint8Array>;
};

export type TerminalSocketData = {
  kind: "terminal";
  services: AppServices;
  sessionId: string;
  terminalId: string;
  clientId?: string;
};

export type SocketData = PreviewSocketData | TerminalSocketData;
