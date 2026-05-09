# External Access With Tailscale And Telegram Auth

Codex Web IDE controls local files, Git, terminals, preview servers, and Codex sessions. Treat any network-exposed instance like a remote development shell. Prefer a private Tailscale network over direct public internet exposure, and keep Telegram approval authentication enabled for every non-loopback listener.

## Recommended Topology

Use this layout for personal remote access:

```text
Browser device -> Tailscale private IP/DNS -> Codex Web IDE host -> local projects
Telegram bot   -> login approval channel
```

This keeps Codex Web IDE off the public internet while still allowing remote access from trusted devices.

## 1. Install And Join Tailscale

Install Tailscale on the device running Codex Web IDE and on every browser device that should access it.

On Linux or WSL:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

On Termux, use the Android Tailscale app when possible and keep Termux running in the same device network context.

Find the private Tailscale address:

```bash
tailscale ip -4
```

You can also use the device MagicDNS name if MagicDNS is enabled in the Tailscale admin console.

## 2. Configure Telegram Authentication

Create a Telegram bot with BotFather, then pair Codex Web IDE with your Telegram account:

```bash
cw config telegram
```

The command validates the bot token, waits for `/start`, stores the allowed Telegram user and chat id, and sends a test message. Bot tokens are stored in `secrets.json` under `CODEX_WEB_HOME` with restricted file permissions.

Environment overrides are available for automation:

```text
CW_TELEGRAM_BOT_TOKEN
CW_TELEGRAM_API_BASE
CW_SESSION_SECRET
CW_CSRF_SECRET
```

Do not commit these values to a project repository.

## 3. Start Codex Web IDE For Tailscale Access

Bind to all interfaces or to the Tailscale IP. Non-loopback hosts require authentication unless explicitly disabled.

```bash
cw start --host 0.0.0.0 --port 17321 --auth enable
```

Then open one of:

```text
http://<tailscale-ip>:17321
http://<magicdns-name>:17321
```

The browser will show a Telegram approval screen. Approve the login request from the configured Telegram bot to create the browser session.

## 4. Session And Browser Security

The web session uses:

- HttpOnly browser session cookie
- CSRF token for state-changing API requests
- Origin and Host validation
- single active browser session by default
- audit log entries for login, approval, denial, logout, CSRF failure, and origin failure
- sandboxed iframe preview surfaces where browser features allow it

Audit logs are stored as JSON lines under:

```text
~/.codex-web/logs/audit.log
```

## 5. Preview Servers

Preview servers started through `cw preview` are intended to stay behind the Codex Web IDE proxy. Open previews from the web UI instead of exposing preview runtime ports directly.

When a framework requires an explicit host, Codex Web IDE injects managed host and port flags for supported runtimes. Keep the app entrypoint behind Tailscale and authenticated.

## 6. Operational Checklist

Before exposing the app beyond `127.0.0.1`:

- Tailscale is active on the server and client devices.
- `cw config telegram` has completed successfully.
- `cw start` uses `--auth enable` for external access.
- Browser access uses the Tailscale IP or MagicDNS name.
- Direct router port forwarding is disabled.
- Bot tokens and secrets are not stored in the project repository.
- Termux devices have wake lock or battery optimization exemptions when long-running jobs are needed.

## 7. Stop Access

Stop the local server:

```bash
cw stop
```

To remove remote network reachability, also stop Tailscale or remove the device from the tailnet.
