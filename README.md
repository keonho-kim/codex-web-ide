# Codex Web IDE

Codex Web IDE is a local-first development environment for running Codex workflows from a web UI. It is designed for Termux first, while keeping macOS, Linux, and WSL support practical.

## Requirements

- Bun
- Git
- Codex CLI or SDK access
- Optional project runtimes such as Python, Go, and Rust

Run the environment check before starting work:

```bash
cw doctor
```

## Start The App

```bash
cw start
```

The default app URL is:

```text
http://127.0.0.1:17321
```

To listen on another host or port:

```bash
cw start --host 0.0.0.0 --port 17321
```

When binding to a non-loopback host, Telegram approval authentication is enabled unless `CODEX_WEB_AUTH=0` is set. Configure it before exposing the app:

```bash
cw config telegram
cw start --host 0.0.0.0 --auth enable
```

For remote access, prefer Tailscale over public port forwarding:

```bash
tailscale ip -4
cw start --host 0.0.0.0 --port 17321 --auth enable
```

Then open `http://<tailscale-ip>:17321` from another device in the same tailnet and approve the browser session from Telegram. See [External Access With Tailscale And Telegram Auth](docs/external-access.md) for the full setup and security checklist.

## Managed Commands

Use managed commands so the backend can track process state, logs, ports, and previews.

```bash
cw job bun run build
cw preview bun run dev
cw service python bot.py
```

Use `cw job` for commands expected to finish, `cw preview` for browser-viewable web servers, and `cw service` for long-running background processes.

Dangerous commands are blocked unless explicitly approved:

```bash
cw job --approve-dangerous git reset --hard
```

## Project Workflow

```bash
cw init /path/to/project
cw open
cw status
cw stop
```

`cw init` registers the project and creates an `AGENTS.md` runtime policy when one does not already exist.

The web UI supports project/session selection, file tree browsing, Monaco editing, Codex chat, file and skill mentions, jobs, previews, services, and Git state/status/diff/stage/unstage/commit workflows.

## Termux Notes

For long-running sessions on Android, prevent Termux from being suspended:

```bash
termux-wake-lock
```

If projects live in shared storage, grant storage access first:

```bash
termux-setup-storage
```

Android battery optimization may still stop background work. Keep Termux visible or exempt it from battery optimization when running long jobs, previews, or services.

## Environment

```text
CODEX_WEB_HOME                 Data directory, default ~/.codex-web
CODEX_WEB_HOST                 App host, default 127.0.0.1
CODEX_WEB_PORT                 App port, default 17321
CODEX_WEB_AUTH                 1 to force auth, 0 to disable auth
CW_TELEGRAM_BOT_TOKEN          Telegram bot token override for auth
CW_TELEGRAM_API_BASE           Telegram Bot API base URL, mainly for tests
CW_SESSION_SECRET              Session secret override
CW_CSRF_SECRET                 CSRF secret override
CODEX_WEB_PREVIEW_PORT_START   Preview port range start, default 17330
CODEX_WEB_PREVIEW_PORT_END     Preview port range end, default 17399
```
