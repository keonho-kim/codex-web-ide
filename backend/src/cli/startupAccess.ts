import os from "node:os";

export type StartupAccessInfo = {
  host: string;
  port: number;
  boundUrl: string;
  localUrls: string[];
  internalUrls: string[];
  externalUrl?: string;
  externalError?: string;
  loopbackOnly: boolean;
};

type ExternalIpLookup = () => Promise<string | undefined>;

const EXTERNAL_IP_ATTEMPTS = 5;
const EXTERNAL_IP_RETRY_DELAY_MS = 500;
const EXTERNAL_IP_TIMEOUT_MS = 1500;

export async function collectStartupAccessInfo(host: string, port: number, lookupExternalIp: ExternalIpLookup = lookupPublicIp): Promise<StartupAccessInfo> {
  const normalizedHost = host || "127.0.0.1";
  const loopbackOnly = isLoopbackHost(normalizedHost);
  const publicIpResult = await lookupExternalIp().then(
    (ip) => ({ ip }),
    (error) => ({ error: error instanceof Error ? error.message : String(error) }),
  );
  const externalIp = "ip" in publicIpResult ? publicIpResult.ip : undefined;
  const localUrls = unique(["127.0.0.1", "localhost"].map((address) => httpUrl(address, port)));
  const internalUrls = loopbackOnly ? [] : unique(internalAddresses().map((address) => httpUrl(address, port)));

  return {
    host: normalizedHost,
    port,
    boundUrl: httpUrl(normalizedHost, port),
    localUrls,
    internalUrls,
    externalUrl: externalIp && !loopbackOnly ? httpUrl(externalIp, port) : undefined,
    externalError: "error" in publicIpResult ? publicIpResult.error : undefined,
    loopbackOnly,
  };
}

export function formatStartupAccessInfo(info: StartupAccessInfo, authEnabled: boolean) {
  const lines = [
    "Codex Web IDE access",
    `  Bound:   ${info.boundUrl}`,
    `  Port:    ${info.port}`,
    `  Auth:    ${authEnabled ? "Telegram approval enabled" : "disabled"}`,
    "  Local:",
    ...info.localUrls.map((url) => `    - ${url}`),
  ];

  if (info.internalUrls.length > 0) {
    lines.push("  Internal network:");
    lines.push(...info.internalUrls.map((url) => `    - ${url}`));
  } else {
    lines.push(`  Internal network: ${info.loopbackOnly ? "not reachable while bound to loopback" : "no active IPv4 address found"}`);
  }

  if (info.externalUrl) {
    lines.push("  External:");
    lines.push(`    - ${info.externalUrl}`);
    lines.push("    Public access still depends on firewall, router, VPN, or tunnel configuration.");
  } else {
    lines.push(`  External: ${info.loopbackOnly ? "not reachable while bound to loopback" : info.externalError ? `unavailable (${info.externalError})` : "unavailable"}`);
  }

  return lines.join("\n");
}

export function formatStartupTelegramMessage(info: StartupAccessInfo, authEnabled: boolean) {
  return [
    "Codex Web IDE started",
    "",
    `Port: ${info.port}`,
    `Auth: ${authEnabled ? "Telegram approval enabled" : "disabled"}`,
    `Bound: ${info.boundUrl}`,
    "",
    "Local:",
    ...info.localUrls.map((url) => `- ${url}`),
    "",
    "Internal network:",
    ...(info.internalUrls.length > 0 ? info.internalUrls.map((url) => `- ${url}`) : [`- ${info.loopbackOnly ? "not reachable while bound to loopback" : "no active IPv4 address found"}`]),
    "",
    "External:",
    `- ${info.externalUrl || (info.loopbackOnly ? "not reachable while bound to loopback" : info.externalError ? `unavailable (${info.externalError})` : "unavailable")}`,
    "",
    "Browser login requests still require inline approval from this Telegram bot.",
  ].join("\n");
}

function internalAddresses() {
  return Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !entry.internal && entry.family === "IPv4")
    .map((entry) => entry.address);
}

async function lookupPublicIp() {
  if (process.env.CODEX_WEB_SKIP_EXTERNAL_IP === "1") return undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= EXTERNAL_IP_ATTEMPTS; attempt += 1) {
    try {
      const ip = await lookupPublicIpOnce();
      if (ip) return ip;
    } catch (error) {
      lastError = error;
    }
    if (attempt < EXTERNAL_IP_ATTEMPTS) await delay(EXTERNAL_IP_RETRY_DELAY_MS);
  }
  if (lastError) throw lastError;
  return undefined;
}

async function lookupPublicIpOnce() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_IP_TIMEOUT_MS);
  timeout.unref?.();
  try {
    const response = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { ip?: unknown };
    return typeof body.ip === "string" && body.ip ? body.ip : undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    timeout.unref?.();
  });
}

function httpUrl(host: string, port: number) {
  return `http://${host.includes(":") && !host.startsWith("[") ? `[${host}]` : host}:${port}`;
}

function isLoopbackHost(host: string) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
