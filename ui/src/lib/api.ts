let csrfToken: string | undefined;

export function setCsrfToken(token?: string) {
  csrfToken = token;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method || "GET";
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(errorMessage(text, response.statusText));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function splitCommand(command: string) {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === "\"") && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (!quote && /\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaped) current += "\\";
  if (current) parts.push(current);
  return parts;
}

function errorMessage(text: string, fallback: string) {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    return typeof parsed.error === "string" ? parsed.error : text;
  } catch {
    return text;
  }
}
