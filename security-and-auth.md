# Codex Web 보안 및 Telegram 인증/원격제어 설계서

## 1. 개요

본 문서는 Codex Web 프로젝트에 추가할 **보안 기능**과 **Telegram 기반 인증/승인/원격제어 기능**만을 별도로 정의한다.

Codex Web은 단순 웹앱이 아니라 로컬 파일시스템, Git, Codex, shell command, preview server, service runner를 제어하는 개발 도구다. 따라서 외부에서 접근 가능한 상태로 실행할 경우, 인증되지 않은 사용자가 접속하면 로컬 개발 환경 전체가 노출될 수 있다.

이 설계의 핵심 목표는 다음과 같다.

* 기본적으로 인증 없이는 웹 UI에 접근할 수 없게 한다.
* `cw start --auth enable` 옵션으로 Telegram 승인 기반 인증을 활성화한다.
* Telegram 설정은 `cw config telegram`을 통해 사전에 수행한다.
* 웹 UI 동시 접속은 최대 1명으로 제한한다.
* 새 접속은 Telegram에서 승인하거나 기존 세션을 교체해야 한다.
* 추후 Telegram을 통해 Codex chat, job 실행, preview 제어, 승인 응답 등 원격 제어 기능으로 확장할 수 있게 한다.

---

## 2. 범위

### 2.1 포함 범위

이 문서에서 다루는 기능은 다음과 같다.

* Telegram bot 설정
* Telegram owner pairing
* `--auth enable` 실행 옵션
* Telegram 승인 기반 로그인
* 최대 동시 접속 1명 제한
* session heartbeat
* session replacement approval
* auth middleware
* CSRF / Origin 검증
* audit log
* Telegram remote control 확장 구조
* approval system과 Telegram 통합

### 2.2 제외 범위

이 문서에서는 다음을 다루지 않는다.

* 전체 앱 아키텍처
* React 파일 탐색기/에디터 설계
* Codex 세션 기본 설계
* PreviewManager 전체 설계
* GitManager 전체 설계
* 패키징/배포 전체 설계

---

## 3. 기본 보안 모델

### 3.1 위협 모델

Codex Web에 접속한 사용자는 사실상 다음 권한을 가질 수 있다.

```text
파일 읽기/쓰기
Git stage/commit/push
Codex 세션 실행
job 실행
preview/service 실행
프로젝트 내 secret 파일 접근 가능성
```

따라서 인증되지 않은 접근은 원격 shell 또는 원격 IDE 접근과 비슷한 위험으로 간주한다.

### 3.2 기본 원칙

```text
1. 인증은 기본적으로 켤 수 있어야 한다.
2. 외부 노출 시 인증은 필수다.
3. Telegram은 접속 승인 채널로 사용한다.
4. 실제 권한 판단은 backend session이 담당한다.
5. 웹 UI 동시 접속은 기본 최대 1명으로 제한한다.
6. 모든 위험 작업은 audit log에 남긴다.
7. preview proxy는 등록된 local preview만 허용한다.
8. 파일 접근은 session cwd 내부로 제한한다.
```

---

## 4. CLI 옵션 및 설정 흐름

### 4.1 Telegram 설정

Telegram 인증을 사용하려면 먼저 다음 명령을 실행한다.

```bash
cw config telegram
```

설정 과정:

```text
1. Telegram bot token 입력
2. bot token 검증
3. 사용자에게 bot username 안내
4. 사용자가 Telegram에서 해당 bot에게 /start 전송
5. cw가 Telegram getUpdates polling으로 /start 수신
6. from.id, chat.id 확인
7. 해당 Telegram 계정을 owner로 등록
8. test message 발송
9. 설정 저장
```

### 4.2 Auth 활성화

Telegram 설정이 완료된 이후 다음처럼 서버를 실행한다.

```bash
cw start --auth enable
```

`--auth enable`을 사용하면 backend는 시작 시 다음을 확인한다.

```text
telegram config 존재 여부
bot token 존재 여부
allowedTelegramUserId 존재 여부
allowedChatId 존재 여부
session secret 존재 여부
csrf secret 존재 여부
```

설정이 없으면 서버 시작을 중단한다.

```text
Telegram auth is not configured.
Run:
  cw config telegram
```

### 4.3 향후 옵션

확장성을 위해 다음 옵션을 허용할 수 있다.

```bash
cw start --auth enable --auth-provider telegram
cw start --auth disable
cw start --auth enable --single-session true
```

MVP에서는 `--auth enable`이 곧 Telegram auth를 의미해도 된다.

---

## 5. 설정 파일 설계

### 5.1 저장 위치

```text
~/.codex-web/config.json
~/.codex-web/secrets.json
~/.codex-web/logs/audit.log
```

### 5.2 config.json

민감하지 않은 설정만 저장한다.

```json
{
  "auth": {
    "enabled": true,
    "provider": "telegram",
    "singleSession": true,
    "loginRequestTtlMs": 120000,
    "heartbeatIntervalMs": 15000,
    "sessionStaleMs": 90000,
    "sessionIdleTimeoutMs": 1800000,
    "sessionAbsoluteTtlMs": 43200000
  },
  "telegram": {
    "allowedTelegramUserId": 123456789,
    "allowedChatId": 123456789,
    "ownerDisplayName": "User",
    "remoteControlEnabled": false
  }
}
```

### 5.3 secrets.json

민감한 값은 별도 secrets 파일에 저장한다.

```json
{
  "telegram": {
    "botToken": "123456:ABC..."
  },
  "auth": {
    "sessionSecret": "random-session-secret",
    "csrfSecret": "random-csrf-secret"
  }
}
```

권장 권한:

```bash
chmod 600 ~/.codex-web/secrets.json
```

### 5.4 환경변수 우선순위

bot token은 환경변수로도 제공할 수 있다.

```bash
export CW_TELEGRAM_BOT_TOKEN="123456:ABC..."
```

설정 우선순위:

```text
1. CLI argument
2. environment variable
3. secrets.json
4. config.json
5. default value
```

---

## 6. TelegramAuthManager 설계

### 6.1 역할

`TelegramAuthManager`는 Telegram bot 연동을 담당한다.

담당 기능:

```text
bot token 검증
owner pairing
login approval message 전송
callback query 처리
remote command polling
approval result 반영
Telegram audit log 기록
```

### 6.2 내부 구성

```text
TelegramAuthManager
  ├─ TelegramClient
  ├─ PairingManager
  ├─ LoginApprovalManager
  ├─ CallbackQueryRouter
  ├─ RemoteCommandRouter
  └─ TelegramAuditLogger
```

### 6.3 Long polling 방식

MVP에서는 webhook 대신 long polling을 사용한다.

이유:

```text
Termux/LTE 환경에서는 외부 webhook endpoint를 안정적으로 열기 어렵다.
Cloudflare Tunnel이나 고정 도메인이 없어도 동작해야 한다.
Telegram bot이 outbound API 호출만으로 동작해야 한다.
```

구조:

```text
Telegram Bot API getUpdates
  ↓
TelegramUpdatePoller
  ↓
CallbackQueryRouter
  ↓
LoginApprovalManager / RemoteCommandRouter
```

---

## 7. Telegram Pairing Flow

### 7.1 명령

```bash
cw config telegram
```

### 7.2 흐름

```text
1. CLI가 bot token 입력 요청
2. TelegramClient.getMe()로 token 검증
3. bot username 출력
4. 사용자가 Telegram에서 /start 전송
5. CLI가 getUpdates polling 시작
6. /start message 수신
7. from.id, chat.id 표시
8. 사용자에게 owner 등록 여부 확인
9. allowedTelegramUserId, allowedChatId 저장
10. test message 전송
```

### 7.3 CLI 출력 예시

```text
Telegram bot verified: @my_codex_web_bot

Open Telegram and send /start to this bot.
Waiting for message...

Received /start from:
  Name: User
  User ID: 123456789
  Chat ID: 123456789

Use this Telegram account as Codex Web owner? [Y/n]
```

### 7.4 저장 결과

```json
{
  "telegram": {
    "allowedTelegramUserId": 123456789,
    "allowedChatId": 123456789,
    "ownerDisplayName": "User",
    "remoteControlEnabled": false
  }
}
```

---

## 8. Login Approval Flow

### 8.1 전체 흐름

```text
Browser 접속
  ↓
Auth middleware가 session 없음 확인
  ↓
LoginRequest 생성
  ↓
/login 화면 표시
  ↓
Telegram으로 승인 요청 전송
  ↓
사용자가 Approve 또는 Deny 선택
  ↓
Browser가 login request 상태 polling
  ↓
승인 시 HttpOnly session cookie 발급
  ↓
앱 접근 허용
```

### 8.2 LoginRequest 모델

```ts
type LoginRequest = {
  id: string;
  code: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "denied" | "expired";
  approvedByTelegramUserId?: number;
  approvedAt?: number;
  completeTokenHash?: string;
};
```

### 8.3 Telegram 승인 메시지

```text
Codex Web login request

Code: 482913
IP: 100.x.y.z
Device: Chrome on macOS
Time: 2026-05-09 22:31

Approve this login?
```

Inline keyboard:

```text
[Approve] [Deny]
```

### 8.4 Browser Login Page

```text
Waiting for Telegram approval

Code: 482913

Approve this request from your Telegram bot.
This request expires in 2 minutes.
```

### 8.5 만료 정책

권장값:

```text
login request TTL: 2분
max pending login requests: 5
same IP request cooldown: 5초
```

---

## 9. Single Session 정책

### 9.1 목표

웹 UI active session은 최대 1개만 허용한다.

### 9.2 ActiveUserSession 모델

```ts
type ActiveUserSession = {
  id: string;
  telegramUserId: number;
  ip: string;
  userAgent: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  replacedAt?: number;
  revokedAt?: number;
};
```

### 9.3 기존 active session이 없는 경우

```text
Login approval 성공
  ↓
새 active session 생성
  ↓
HttpOnly session cookie 발급
```

### 9.4 기존 active session이 있는 경우

새 로그인 요청이 들어오면 Telegram에 교체 승인 메시지를 보낸다.

```text
New Codex Web login request

Current session:
- Device: Chrome on macOS
- IP: 100.x.y.z
- Last seen: 20 seconds ago

New request:
- Device: Safari on iPad
- IP: 100.x.y.z
- Code: 738201

Replace current session?
```

Inline keyboard:

```text
[Replace] [Deny]
```

`Replace` 선택 시:

```text
1. 기존 active session revoked
2. 새 login request approved
3. 새 session cookie 발급
4. 기존 브라우저에는 session.expired 이벤트 전송
```

### 9.5 Heartbeat

브라우저는 주기적으로 heartbeat를 보낸다.

```text
POST /api/auth/heartbeat
```

권장값:

```text
heartbeat interval: 15초
stale timeout: 90초
idle timeout: 30분
absolute session TTL: 12시간
```

stale session은 자동 해제한다.

---

## 10. Auth API 설계

### 10.1 API 목록

```text
GET  /api/auth/status
POST /api/auth/login/request
GET  /api/auth/login/:requestId/status
POST /api/auth/login/:requestId/complete
POST /api/auth/logout
POST /api/auth/heartbeat
```

### 10.2 Auth status

```http
GET /api/auth/status
```

응답:

```json
{
  "authenticated": false,
  "authEnabled": true,
  "provider": "telegram",
  "singleSession": true
}
```

### 10.3 Login request 생성

```http
POST /api/auth/login/request
```

응답:

```json
{
  "requestId": "lr_abc123",
  "code": "482913",
  "expiresAt": 1778331120000
}
```

### 10.4 Login status polling

```http
GET /api/auth/login/lr_abc123/status
```

pending 응답:

```json
{
  "status": "pending"
}
```

approved 응답:

```json
{
  "status": "approved",
  "completeToken": "one-time-token"
}
```

### 10.5 Login complete

```http
POST /api/auth/login/lr_abc123/complete
```

body:

```json
{
  "completeToken": "one-time-token"
}
```

성공 시:

```http
Set-Cookie: cw_session=...; HttpOnly; SameSite=Strict; Path=/
```

HTTPS 환경에서는 다음도 추가한다.

```http
Secure
```

---

## 11. Auth Middleware

### 11.1 보호 대상

다음 route는 인증이 필요하다.

```text
/api/sessions/*
/api/files/*
/api/git/*
/api/commands/*
/api/previews/*
/api/services/*
/preview/*
SSE endpoint
```

### 11.2 예외 대상

```text
/api/auth/status
/api/auth/login/request
/api/auth/login/:id/status
/api/auth/login/:id/complete
/static/*
/assets/*
/login
```

### 11.3 인증 실패 처리

```text
API 요청: 401 JSON 응답
Page 요청: /login redirect
SSE 요청: 401 후 연결 종료
```

---

## 12. CSRF 및 Origin 검증

### 12.1 필요성

Telegram 승인은 로그인 시점만 보호한다. 로그인 이후에는 브라우저 세션 쿠키가 존재하므로 CSRF 방어가 필요하다.

### 12.2 Origin allowlist

허용 origin 예시:

```text
http://127.0.0.1:17321
http://localhost:17321
http://<configured-host>:17321
http://<tailscale-ip>:17321
```

### 12.3 State-changing 요청 보호

다음 method는 CSRF 검증 대상이다.

```text
POST
PUT
PATCH
DELETE
```

특히 다음 API는 반드시 보호한다.

```text
POST /api/commands/*
POST /api/git/*
PUT  /api/files/write
POST /api/previews/*
POST /api/services/*
```

### 12.4 CSRF token 전달

로그인 성공 후 frontend는 CSRF token을 받아 state-changing 요청에 포함한다.

```http
X-CSRF-Token: <token>
```

---

## 13. Cookie 및 Session 보안

### 13.1 Cookie 설정

기본 cookie:

```http
HttpOnly
SameSite=Strict
Path=/
```

HTTPS 환경:

```http
Secure
```

### 13.2 Session 저장

MVP에서는 in-memory session store를 사용할 수 있다.

권장:

```text
MVP: in-memory
v1: ~/.codex-web/session-store.json 또는 sqlite
```

### 13.3 Session 폐기 조건

```text
사용자 logout
Telegram replacement 승인
heartbeat stale timeout
absolute TTL 만료
서버 재시작
cw auth logout-all
```

---

## 14. Preview Proxy 보안

### 14.1 원칙

Preview proxy는 임의 URL proxy가 되어서는 안 된다.

허용:

```text
/preview/:sessionId/:previewId/*
  → PreviewManager가 등록한 127.0.0.1:<allocatedPort>
```

금지:

```text
/proxy?url=http://...
/preview?target=...
사용자가 임의 host/port 지정
```

### 14.2 인증 적용

`/preview/*`도 auth middleware를 통과해야 한다.

즉 인증되지 않은 사용자는 preview app에도 접근할 수 없다.

---

## 15. Telegram Remote Control 확장 설계

### 15.1 개요

Telegram remote control은 MVP 인증 이후 확장 기능으로 추가한다.

목표:

```text
Telegram에서 앱 상태 확인
Telegram에서 Codex chat 전송
Telegram에서 job 실행 요청
Telegram에서 preview 시작/중지
Telegram에서 Git 상태 확인
Telegram에서 approval 응답
```

### 15.2 기본 비활성화

remote control은 기본적으로 꺼져 있다.

```json
{
  "telegram": {
    "remoteControlEnabled": false
  }
}
```

활성화:

```bash
cw config telegram remote enable
```

비활성화:

```bash
cw config telegram remote disable
```

### 15.3 Remote command 목록

초기 후보:

```text
/status
/sessions
/use <session-id>
/chat <message>
/git
/jobs
/previews
/build
/test
/preview_start
/preview_stop
/approve <request-id>
/deny <request-id>
/logout
/help
```

### 15.4 예시

```text
User:
/status

Bot:
Codex Web running
Active project: my-app
Branch: feature/telegram-auth
Dirty: yes
Preview: running
Jobs: none
```

```text
User:
/chat 현재 변경사항 검토하고 build 실패 원인 찾아줘

Bot:
Sent to Codex session: my-app
```

### 15.5 RemoteCommand 모델

```ts
type RemoteCommand = {
  id: string;
  telegramUserId: number;
  chatId: number;
  command: string;
  args: string[];
  rawText: string;
  createdAt: number;
  status: "received" | "running" | "succeeded" | "failed" | "denied";
};
```

### 15.6 권한 정책

owner user id에서 온 메시지만 처리한다.

```ts
if (update.from.id !== allowedTelegramUserId) {
  denyOrIgnore(update);
}
```

위험 명령은 Telegram에서 입력했더라도 즉시 실행하지 않고 approval flow를 사용한다.

위험 명령 예:

```text
Git push
Git reset
file delete
service start
arbitrary shell
Codex command requiring approval
```

---

## 16. Approval System 통합

### 16.1 목적

Telegram은 login approval뿐 아니라 command approval 채널로도 사용한다.

### 16.2 ApprovalRequest 모델

```ts
type ApprovalRequest = {
  id: string;
  sessionId?: string;
  kind: "login" | "command" | "git" | "preview" | "service" | "codex";
  title: string;
  description: string;
  payload: unknown;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "denied" | "expired";
};
```

### 16.3 예시

Codex가 위험 명령을 실행하려는 경우:

```text
Approval required

Session: my-app
Command:
  git push origin feature/telegram-auth

Approve?
```

Inline keyboard:

```text
[Approve] [Deny]
```

### 16.4 Web UI와 Telegram 동시 승인

approval request는 Web UI와 Telegram 양쪽에 표시할 수 있다.

```text
Web UI에서 승인
또는
Telegram에서 승인
```

먼저 처리된 결과가 최종 상태가 된다.

---

## 17. Audit Log

### 17.1 저장 위치

```text
~/.codex-web/logs/audit.log
```

### 17.2 기록 대상

```text
login.requested
login.approved
login.denied
login.expired
session.created
session.replaced
session.revoked
telegram.command.received
telegram.command.denied
approval.requested
approval.approved
approval.denied
csrf.failed
origin.denied
auth.failed
```

### 17.3 로그 예시

```json
{
  "timestamp": 1778331120000,
  "type": "login.approved",
  "requestId": "lr_abc123",
  "telegramUserId": 123456789,
  "ip": "100.x.y.z",
  "userAgent": "Chrome on macOS"
}
```

### 17.4 민감정보 마스킹

다음 값은 로그에 원문 저장하지 않는다.

```text
Telegram bot token
session cookie
CSRF token
complete token
Authorization header
.env 값
```

---

## 18. Frontend UI 변경사항

### 18.1 Login Page

경로:

```text
/login
```

표시 항목:

```text
Telegram approval 대기 상태
login code
만료까지 남은 시간
재요청 버튼
Telegram 설정 오류
```

### 18.2 Session Expired 화면

기존 세션이 교체되었거나 timeout되면 표시한다.

```text
Your session has expired or was replaced by another login.

[Request access again]
```

### 18.3 Topbar Auth 상태

Topbar에 간단히 표시할 수 있다.

```text
Auth: Telegram
Session: active
```

### 18.4 Remote Control 상태

나중에 remote control이 켜져 있으면 표시한다.

```text
Telegram remote: enabled
```

---

## 19. Backend 모듈 구조

추가할 backend 모듈:

```text
server/src/auth/
  AuthManager.ts
  AuthMiddleware.ts
  SessionStore.ts
  CsrfManager.ts
  LoginRequestStore.ts

server/src/telegram/
  TelegramClient.ts
  TelegramAuthManager.ts
  TelegramConfigFlow.ts
  TelegramUpdatePoller.ts
  TelegramCallbackRouter.ts
  TelegramRemoteCommandRouter.ts

server/src/approval/
  ApprovalManager.ts
  ApprovalStore.ts

server/src/audit/
  AuditLogger.ts
```

---

## 20. CLI 명령 추가

추가할 CLI 명령:

```bash
cw config telegram
cw config telegram status
cw config telegram reset
cw config telegram remote enable
cw config telegram remote disable
cw auth status
cw auth logout-all
```

### 20.1 `cw config telegram status`

출력 예:

```text
Telegram auth configuration

Bot:        @my_codex_web_bot
Owner:      User (123456789)
Chat ID:    123456789
Remote:     disabled
Auth ready: yes
```

### 20.2 `cw auth logout-all`

현재 active session을 폐기한다.

single session 모드에서는 active session 하나만 폐기한다.

---

## 21. 구현 순서

### Phase A: Auth Foundation

```text
1. Auth config schema 추가
2. secrets storage 추가
3. session secret / csrf secret 생성
4. SessionStore 구현
5. AuthMiddleware 구현
6. Login page 추가
7. --auth enable 옵션 추가
```

### Phase B: Telegram Pairing

```text
1. TelegramClient 구현
2. cw config telegram 구현
3. getMe token 검증
4. getUpdates 기반 /start pairing
5. allowed user/chat 저장
6. test message 발송
```

### Phase C: Login Approval

```text
1. LoginRequestStore 구현
2. Telegram approval message 전송
3. inline keyboard callback 처리
4. login status polling 구현
5. completeToken 검증
6. HttpOnly session cookie 발급
7. deny/expire 처리
```

### Phase D: Single Session

```text
1. ActiveSession lock 구현
2. heartbeat API 구현
3. stale session cleanup 구현
4. replacement approval flow 구현
5. 기존 session revoked event 처리
```

### Phase E: Hardening

```text
1. CSRF token 추가
2. Origin 검증 추가
3. rate limit 추가
4. audit log 추가
5. secrets masking 추가
6. preview proxy auth 적용 확인
7. cw doctor auth check 추가
```

### Phase F: Telegram Remote Control

```text
1. remote control config 추가
2. /status 구현
3. /sessions 구현
4. /chat 구현
5. /git, /jobs, /previews 조회 구현
6. approval system과 Telegram callback 통합
7. 위험 명령 제한 및 audit log 강화
```

---

## 22. MVP 포함 범위

Telegram Auth MVP에는 다음을 포함한다.

```text
cw config telegram
cw config telegram status
cw start --auth enable
Telegram owner pairing
Telegram login approval
HttpOnly session cookie
single session enforcement
heartbeat
session replacement approval
Auth middleware
Origin check
CSRF token
Audit log 기본 기록
```

MVP에서 제외해도 되는 항목:

```text
Telegram remote /chat
Telegram remote /build
Telegram remote /preview_start
webhook mode
multi-user support
password auth
role-based permissions
```

---

## 23. 최종 요약

이 보안 설계의 핵심은 다음이다.

```text
1. 외부 접속은 Telegram 승인 없이는 불가능하게 한다.
2. `cw start --auth enable`은 Telegram 설정이 완료된 경우에만 허용한다.
3. 웹 UI 동시 접속은 최대 1명으로 제한한다.
4. 새 접속은 Telegram에서 Replace 승인을 받아야 한다.
5. Telegram은 추후 Codex 원격 제어 채널로 확장한다.
6. 실제 권한과 세션 관리는 Express backend가 담당한다.
7. CSRF, Origin check, HttpOnly cookie, audit log를 기본 보안층으로 둔다.
```

권장 기본 실행 방식:

```bash
cw config telegram
cw start --auth enable
```

외부 접속을 열 경우:

```bash
cw start --host 0.0.0.0 --auth enable
```

이 경우에도 접속자는 Telegram 승인을 받아야 하며, active browser session은 최대 1개만 유지된다.

