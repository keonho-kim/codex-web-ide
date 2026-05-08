import { startServer } from "./server";

const server = await startServer();
console.log(`Codex Web IDE listening on http://${server.host}:${server.port}`);
