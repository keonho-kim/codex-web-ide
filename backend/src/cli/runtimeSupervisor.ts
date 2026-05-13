import { removePidFile } from "@backend/cli/pidFile";

export type RuntimeSupervisorOptions = {
  duplicateNoticeDelayMs?: number;
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: (message: string) => void;
  error?: (message: string) => void;
  removePid?: () => Promise<void>;
};

const SHUTDOWN_TIMEOUT_MS = 5000;
const DUPLICATE_NOTICE_DELAY_MS = 500;

export function createRuntimeSupervisor(closeServer: () => Promise<void>, options: RuntimeSupervisorOptions = {}) {
  let closing = false;
  let closingStartedAt = 0;
  let finished = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const exit = options.exit ?? ((code) => process.exit(code));
  const log = options.log ?? ((message) => console.log(message));
  const errorLog = options.error ?? ((message) => console.error(message));
  const removePid = options.removePid ?? removePidFile;
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  const duplicateNoticeDelayMs = options.duplicateNoticeDelayMs ?? DUPLICATE_NOTICE_DELAY_MS;
  let exitCode = 0;

  const finish = (code: number) => {
    if (finished) return;
    finished = true;
    if (timeout) clearTimeout(timeout);
    void removePid()
      .catch((error) => {
        errorLog(error instanceof Error ? error.message : "Failed to remove pid file.");
      })
      .finally(() => exit(code));
  };

  return () => {
    if (closing) {
      if (Date.now() - closingStartedAt >= duplicateNoticeDelayMs) errorLog("Shutdown already in progress. Waiting for cleanup to finish.");
      return;
    }
    closing = true;
    closingStartedAt = Date.now();
    log("Shutting down Codex Web IDE...");
    timeout = setTimeout(() => {
      errorLog("Shutdown timed out; forcing exit.");
      finish(1);
    }, timeoutMs);
    timeout.unref?.();

    void closeServer()
      .catch((error) => {
        errorLog(error instanceof Error ? error.message : "Failed to close Codex Web IDE.");
        process.exitCode = 1;
        exitCode = 1;
      })
      .finally(() => finish(exitCode));
  };
}
