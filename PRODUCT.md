# Codex Web IDE 설계서

## 1. 개요

본 문서는 Termux 환경을 1차 타깃으로 하는 로컬-first Codex Web IDE의 전체 기능 구현 설계를 정의한다. 이 앱은 겉으로는 웹앱이지만, 실질적으로는 Termux 내부에서 실행되는 로컬 개발 에이전트 런타임이다.

핵심 목표는 다음과 같다.

* Android Termux에서 Codex 기반 개발 환경을 웹 UI로 제공한다.
* React 기반 파일 탐색기, 코드 에디터, Codex 세션 UI, preview, Git 작업 UI를 제공한다.
* 모든 실행 작업을 앱이 통제 가능한 방식으로 관리한다.
* Termux뿐 아니라 macOS, Linux, WSL 같은 POSIX 계열 환경에서도 동작할 수 있게 설계한다.
* 설치형 CLI 앱처럼 `cw start` 또는 `codex-web start` 명령으로 실행 가능하게 한다.
* UI는 Codex App을 1차 기준으로 하며, 로컬 기준 이미지는 `./ui-example.jpg`로 둔다.

---

## 2. 제품 컨셉

### 2.1 한 줄 정의

Termux에서 실행되는 로컬 Codex Web IDE.

### 2.2 사용 방식

사용자는 Termux에서 다음처럼 앱을 실행한다.

```bash
cw start
```

이후 브라우저에서 접속한다.

```text
http://127.0.0.1:17321
```

같은 Wi-Fi의 다른 기기에서는 다음처럼 접속할 수 있다.

```text
http://<tablet-ip>:17321
```

### 2.3 UX 목표

사용자는 웹 UI 안에서 다음 작업을 수행한다.

* 프로젝트 선택
* 워크스페이스 설정 및 최근 프로젝트 관리
* 파일 탐색
* 코드 열기/수정
* Codex 세션 생성 및 대화
* chat composer에서 `@` 파일/디렉토리 멘션과 `$` 스킬 멘션 선택
* Codex 작업 결과 확인
* build/test/lint 실행
* 프론트엔드 또는 백엔드 preview 실행
* preview iframe 확인
* Git diff 확인
* stage/unstage/commit/push
* branch 상태 확인 및 branch 생성/전환
* long-running service 상태 확인 및 중지/재시작

---

## 3. 핵심 설계 원칙

### 3.1 Termux-first

1차 지원 환경은 Android Termux다. Termux가 제공하는 POSIX 유사 환경, shell, git, bun, python, go, rust, Codex CLI/SDK를 그대로 활용한다.

### 3.2 Web UI, Local Runtime

UI는 React 웹앱으로 만든다. 그러나 실행 런타임은 브라우저가 아니라 Termux 내부의 Express backend가 담당한다.

```text
Browser / WebView
  ↓
React Web UI
  ↓ REST / SSE
Express Backend
  ↓
Codex / Git / Bun / Python / Go / Rust / filesystem
```

### 3.3 직접 실행 금지, 관리형 실행 우선

Codex가 `bun run dev`, `uvicorn`, `go run`, `cargo run` 같은 장기 실행 명령을 직접 실행하면 앱이 포트, 프로세스, 로그, preview URL을 안정적으로 알기 어렵다.

따라서 모든 실행은 `CommandManager`를 통과한다.

```text
cw job <command...>
cw preview <command...>
cw service <command...>
```

### 3.4 Preview는 감지 대상이 아니라 관리 대상

프리뷰는 열린 포트를 스캔해서 추측하는 방식이 아니라, 앱의 `PreviewManager`가 생성하고 관리하는 1급 리소스로 취급한다.

### 3.5 Git 상태는 서버 상태

현재 branch, dirty 상태, staged/unstaged changes, ahead/behind 등은 UI 로컬 상태가 아니라 backend가 읽어오는 서버 상태로 취급한다.

### 3.6 Cross-platform 가능성 유지

Termux 특화 처리는 얇은 platform adapter에 격리한다. 핵심 로직은 macOS/Linux/WSL에서도 동작 가능하게 유지한다.

### 3.7 Codex App 기준 UI

UI는 Codex App의 데스크톱 앱형 정보 구조를 따른다. 좌측에는 workspace, project, thread, skill 진입점을 두고, 중앙에는 Codex thread와 composer를 배치한다. `./ui-example.jpg`는 레이아웃, 밀도, 색감, composer 위치의 기준 이미지다.

### 3.8 Clean Code와 모듈 경계

각 script, module, manager, UI component는 하나의 명확한 책임을 가져야 한다. 단일 파일 안에 서로 다른 책임을 숨기거나, 관련 없는 실행 흐름과 상태를 한곳에 쌓지 않는다.

어떤 script가 두 개 이상의 책임을 갖게 되면 해당 script를 폴더 기반 module로 승격하고, 책임별 파일로 분리한다.

하나의 파일에 기능적으로 분리되어야 하는 class, object, function이 세 개 이상 쌓이면 전용 folder/module boundary를 만들고, 각 책임을 작고 응집도 높은 파일로 나눈다.

Clean code 기준은 다음을 따른다.

* 명시적인 이름을 사용한다.
* 파일과 module은 작고 응집도 있게 유지한다.
* ownership boundary를 분명히 한다.
* 공유 mutable state를 최소화한다.
* 관련 없는 behavior를 한 파일이나 object에 묶지 않는다.
* 추상화는 실제 중복이나 복잡도를 줄일 때만 추가한다.

### 3.9 Domain Backend / FSD Frontend 지향

Backend는 domain 기반 소프트웨어 아키텍처를 지향한다. Codex, workspace/project, file, command, preview, service, Git, auth 같은 제품 domain은 API route, manager, persistence, event publish 책임을 분리하고, route handler는 orchestration을 얇게 유지한다.

Frontend는 Feature-Sliced Design 방향을 따른다. `features/*`는 제품 기능 단위의 UI와 hook을 소유하고, 여러 feature가 공유하는 렌더러와 primitive는 `shared/*`로 승격한다. 예를 들어 Markdown/HTML/KaTeX rich content renderer는 editor와 chat이 함께 사용하므로 feature 내부가 아니라 shared renderer로 관리한다.

Bundle 최적화는 기능 손실 없이 진행한다. Monaco, markdown/KaTeX, diff viewer, Tiptap처럼 무거운 기능은 lazy import와 Vite manual chunk로 분리하고, 사용자가 해당 기능을 실제로 열 때 로드되도록 유지한다.

---

## 4. 전체 아키텍처

```text
┌───────────────────────────────────────────────┐
│ Browser / Android WebView / Desktop Browser    │
└───────────────────────┬───────────────────────┘
                        │
                        │ HTTP / SSE
                        ↓
┌───────────────────────────────────────────────┐
│ React Web UI                                   │
│                                               │
│ - File Tree                                    │
│ - Monaco Editor                                │
│ - Codex Chat                                   │
│ - Composer Mentions                            │
│ - Preview Pane                                 │
│ - Git Panel                                    │
│ - Project Switcher / Workspace Settings        │
│ - Jobs / Logs / Services                       │
└───────────────────────┬───────────────────────┘
                        │
                        │ REST API / SSE
                        ↓
┌───────────────────────────────────────────────┐
│ Express Backend                                │
│                                               │
│ - SessionManager                               │
│ - WorkspaceManager                             │
│ - CodexSessionManager                          │
│ - FileManager                                  │
│ - CommandManager                               │
│ - JobRunner                                    │
│ - PreviewManager                               │
│ - ServiceManager                               │
│ - GitManager                                   │
│ - EventBus                                     │
│ - ReverseProxy                                 │
│ - PlatformAdapter                              │
└───────────────────────┬───────────────────────┘
                        │
                        ↓
┌───────────────────────────────────────────────┐
│ Local Runtime                                  │
│                                               │
│ - Codex SDK / Codex CLI                        │
│ - git                                          │
│ - bun                                          │
│ - python / uv                                  │
│ - go                                           │
│ - rust / cargo                                 │
│ - project filesystem                           │
└───────────────────────────────────────────────┘
```

---

## 5. 기술 스택

### 5.1 Frontend

* React
* Vite
* TypeScript
* TanStack Query
* Zustand
* React Router
* tiptap -- Composer 구현
* Monaco Editor -- 디자인은 B&W 구성, 문법 강조 포함, Notepad ++와 같은 심플한 디자인과 탭 기능
* react-arborist 또는 react-complex-tree
* react-resizable-panels
* Tailwind CSS
* shadcn/ui
* lucide-react
* diff2html 또는 유사 diff viewer

### 5.2 Backend

* Bun runtime
* Express.js
* TypeScript
* zod
* nanoid
* execa
* chokidar
* http-proxy-middleware 또는 자체 proxy layer
* @openai/codex-sdk

### 5.3 Runtime Tools

* Codex CLI/SDK
* git
* bun
* python / uv
* go
* rust / cargo

### 5.4 기본 포트

```text
Main app:      17321
Preview range: 17330 - 17399
```

외부 공개는 기본적으로 main app 포트 하나만 사용한다. preview는 reverse proxy를 통해 `/preview/:sessionId/:previewId/` 경로로 제공한다.

---

## 6. 패키징 및 실행 방식

### 6.1 CLI 명령

앱은 설치형 CLI 패키지로 제공한다.

```bash
cw start
cw stop
cw restart
cw status
cw doctor
cw open
cw init
cw update
```

실행 관련 명령은 다음과 같이 제공한다.

```bash
cw job <command...>
cw preview <command...>
cw service <command...>
```

### 6.2 설치 방식

초기 배포는 Bun 글로벌 패키지 방식을 사용한다.

```bash
bun install -g ./codex-web-0.1.0.tgz
```

또는 registry 배포 후:

```bash
bun install -g @scope/codex-web
```

### 6.3 package.json bin

```json
{
  "name": "@scope/codex-web",
  "version": "0.1.0",
  "bin": {
    "cw": "./bin/cw.ts",
    "codex-web": "./bin/cw.ts"
  }
}
```

### 6.4 앱 시작

`cw start`는 다음을 수행한다.

1. Express backend 시작
2. React build 결과물 serve
3. API route 등록
4. SSE event stream 시작
5. Preview reverse proxy 등록
6. session registry 초기화
7. platform adapter 초기화
8. doctor check 일부 수행

---

## 7. 프로젝트 구조

```text
codex-web/
  ui/
    src/
    index.html
    vite.config.ts

  backend/
    src/
      index.ts
      api/
      managers/
      platform/
      proxy/
      events/
      shared/
        types.ts
        schemas.ts
      cli/
        cw.ts

  bin/
    cw.ts

  package.json
  bun.lock
  tsconfig.json
```

---

## 8. 주요 도메인 모델

### 8.1 Session

```ts
type Session = {
  id: string;
  name: string;
  cwd: string;
  createdAt: number;
  lastActiveAt: number;
  codexThreadId?: string;
  status: "idle" | "running" | "error";
};
```

### 8.2 CodexSession

```ts
type CodexSession = {
  id: string;
  sessionId: string;
  cwd: string;
  thread: unknown;
  eventBuffer: SessionEvent[];
  running: boolean;
  createdAt: number;
  lastRunAt?: number;
};
```

### 8.3 CommandSpec

```ts
type CommandKind = "job" | "preview" | "service";
type Runtime = "bun" | "python" | "go" | "rust" | "shell";

type CommandSpec = {
  id: string;
  sessionId: string;
  cwd: string;
  kind: CommandKind;
  runtime: Runtime;
  command: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
  port?: number;
};
```

### 8.4 Job

```ts
type Job = {
  id: string;
  sessionId: string;
  cwd: string;
  command: string[];
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  stdout: string[];
  stderr: string[];
};
```

### 8.5 PreviewInstance

```ts
type PreviewInstance = {
  id: string;
  sessionId: string;
  cwd: string;
  command: string[];
  port: number;
  pid: number;
  status: "starting" | "running" | "failed" | "stopped";
  localUrl: string;
  publicUrl: string;
  startedAt: number;
  lastHealthCheckAt?: number;
};
```

### 8.6 ServiceInstance

```ts
type ServiceInstance = {
  id: string;
  sessionId: string;
  cwd: string;
  command: string[];
  pid: number;
  status: "starting" | "running" | "failed" | "stopped";
  startedAt: number;
  restartCount: number;
};
```

### 8.7 GitState

```ts
type GitState = {
  branch: string | null;
  detached: boolean;
  commit: string | null;
  upstream?: string;
  ahead?: number;
  behind?: number;
  dirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};
```

### 8.8 Project

```ts
type Project = {
  id: string;
  name: string;
  cwd: string;
  lastOpenedAt: number;
};
```

### 8.9 WorkspaceSettings

```ts
type WorkspaceSettings = {
  defaultProjectsDir: string;
  activeProjectId?: string;
  recentProjectIds: string[];
};
```

### 8.10 ComposerMention

```ts
type ComposerMention =
  | { type: "file"; path: string; isDirectory: boolean }
  | { type: "skill"; id: string; name: string };
```

---

## 9. Frontend 설계

### 9.1 화면 레이아웃

```text
┌────────────────────────────────────────────────────────────┐
│ Topbar                                                     │
│ Project / Session / Branch / Status / Global Config         │
├──────────────┬────────────────────────────┬────────────────┤
│ File Tree    │ Editor                     │ Codex Chat      │
│              │ Monaco                     │ Timeline Events │
├──────────────┴────────────────────────────┴────────────────┤
│ Bottom Panel                                                │
│ Preview / Diff / Jobs / Services / Logs                     │
└────────────────────────────────────────────────────────────┘
```

UI의 전체 지향점은 Codex App이며 `./ui-example.jpg`를 기준 이미지로 삼는다. 좌측 사이드바는 project/thread/skill 탐색을 담당하고, 중앙 chat surface 하단에는 composer를 고정한다. 전역 Codex 설정은 특정 chat 화면에 묶지 않고 Topbar 우측 상태 pill 그룹 끝의 gear 버튼에서 관리한다.

색감은 밝은 흰색 SaaS 화면이 아니라 light gray 기반의 e-ink display / concrete paper tone을 따른다. `DESIGN.md`의 cool gray semantic palette를 기준으로 page, canvas, panel, border, selected state를 분리하며, 누리끼리한 beige cast와 강한 white glare를 피한다.

### 9.2 Workspace / Project UI

Workspace settings는 기본 프로젝트 디렉토리와 최근 프로젝트 목록을 관리한다. 사용자는 좌측 사이드바 또는 상단 project selector에서 프로젝트를 추가하고 선택한다.

선택된 project의 `cwd`는 다음 기능의 기준이 된다.

* file tree
* editor tabs
* Codex session
* `cw job`, `cw preview`, `cw service`
* Git state/status/diff

### 9.3 Composer mention UI

Chat composer는 `@`와 `$` 멘션을 지원한다.

* `@`는 active project 내부의 디렉토리와 파일을 모두 검색한다.
* `$`는 사용 가능한 skill을 검색한다.
* 후보 목록은 composer 근처에 표시한다.
* `ArrowUp` / `ArrowDown`으로 후보를 이동한다.
* `Enter` 또는 `Tab`으로 선택한다.
* `Escape`로 후보 목록을 닫는다.
* 선택된 항목은 composer 안에서 mention chip으로 표시한다.
* 파일/디렉토리 mention은 Codex 요청 컨텍스트에 path와 directory 여부를 함께 전달한다.
* skill mention은 Codex 실행 지시 컨텍스트에 포함한다.

Chat message cell은 user 입력과 Codex 응답 모두 동일한 rich content renderer를 사용한다. Markdown, GFM table/list, math/KaTeX, 그리고 sanitize된 HTML을 지원해야 하며, server-provided HTML/Markdown 렌더링 시 XSS 방어 요구사항을 유지한다.

### 9.4 TanStack Query 담당 영역

TanStack Query는 서버 상태를 담당한다.

* workspace settings
* projects
* sessions
* file tree
* file content
* available skills
* git state
* git status
* git diff
* jobs
* previews
* services

예시:

```ts
useQuery({
  queryKey: ["git-state", sessionId],
  queryFn: () => api(`/sessions/${sessionId}/git/state`),
  refetchInterval: 3000,
});
```

### 9.5 Zustand 담당 영역

Zustand는 순수 UI 상태를 담당한다.

* activeProjectId
* activeSessionId
* activeFilePath
* openTabs
* selectedPanel
* panel sizes
* sidebar collapsed 여부
* selectedPreviewId
* local editor dirty state
* composer draft
* mention popup state

### 9.6 SSE 이벤트 처리

Backend는 session별 SSE stream을 제공한다.

```text
GET /api/sessions/:id/events
```

Frontend는 event를 수신하여 TanStack Query cache를 갱신한다.

주요 이벤트:

```ts
type SessionEvent =
  | { type: "codex.event"; payload: unknown }
  | { type: "job.started"; job: Job }
  | { type: "job.stdout"; jobId: string; text: string }
  | { type: "job.stderr"; jobId: string; text: string }
  | { type: "job.finished"; jobId: string; exitCode: number }
  | { type: "preview.started"; preview: PreviewInstance }
  | { type: "preview.stopped"; previewId: string }
  | { type: "service.started"; service: ServiceInstance }
  | { type: "git.state.updated"; state: GitState }
  | { type: "file.changed"; path: string };
```

---

## 10. Backend API 설계

### 10.1 Session API

```text
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/:id
DELETE /api/sessions/:id
GET    /api/sessions/:id/events
```

### 10.2 Workspace / Project API

```text
GET  /api/workspace/settings
PUT  /api/workspace/settings
GET  /api/projects
POST /api/projects
POST /api/projects/:id/open
```

Project path는 실제 디렉토리여야 하며, session cwd와 파일/Git/명령 API는 선택된 project cwd 밖으로 나갈 수 없다.

### 10.3 Codex API

```text
POST /api/sessions/:id/codex/run
POST /api/sessions/:id/codex/cancel
POST /api/sessions/:id/codex/resume
GET  /api/sessions/:id/codex/events
```

### 10.4 File API

```text
GET  /api/sessions/:id/files/tree?path=...
GET  /api/sessions/:id/files/read?path=...
PUT  /api/sessions/:id/files/write
POST /api/sessions/:id/files/create
POST /api/sessions/:id/files/rename
POST /api/sessions/:id/files/delete
```

모든 path는 session cwd 내부로 제한한다.

### 10.5 Mention API

```text
GET /api/sessions/:id/mentions/files?q=...
GET /api/sessions/:id/mentions/skills?q=...
```

File mention 검색은 파일과 디렉토리를 모두 반환한다. 결과 path는 session cwd 기준 상대 경로만 반환한다.

### 10.6 Command API

```text
POST /api/sessions/:id/commands/job
POST /api/sessions/:id/commands/preview
POST /api/sessions/:id/commands/service
```

### 10.7 Job API

```text
GET  /api/sessions/:id/jobs
GET  /api/sessions/:id/jobs/:jobId
POST /api/sessions/:id/jobs/:jobId/cancel
```

### 10.8 Preview API

```text
GET  /api/sessions/:id/previews
POST /api/sessions/:id/previews
POST /api/sessions/:id/previews/:previewId/stop
POST /api/sessions/:id/previews/:previewId/restart
GET  /preview/:sessionId/:previewId/*
```

### 10.9 Service API

```text
GET  /api/sessions/:id/services
POST /api/sessions/:id/services
POST /api/sessions/:id/services/:serviceId/stop
POST /api/sessions/:id/services/:serviceId/restart
```

### 10.10 Git API

```text
GET  /api/sessions/:id/git/state
GET  /api/sessions/:id/git/status
GET  /api/sessions/:id/git/diff?path=...
GET  /api/sessions/:id/git/diff/staged?path=...
POST /api/sessions/:id/git/stage
POST /api/sessions/:id/git/unstage
POST /api/sessions/:id/git/commit
POST /api/sessions/:id/git/push
POST /api/sessions/:id/git/pull
POST /api/sessions/:id/git/branch
POST /api/sessions/:id/git/checkout
POST /api/sessions/:id/git/create-and-checkout
```

---

## 11. CommandManager 설계

### 11.1 목적

CommandManager는 모든 로컬 명령 실행의 진입점이다.

### 11.2 명령 분류

```text
cw job      → 끝나는 명령
cw preview  → 브라우저에서 볼 수 있는 웹 서버
cw service  → 장기 백그라운드 서비스
```

### 11.3 예시

```bash
cw job bun run build
cw job bun test
cw job go test ./...
cw job cargo build
cw job python -m pytest

cw preview bun run dev
cw preview bun run preview
cw preview uvicorn main:app
cw preview go run ./cmd/web
cw preview cargo run --bin web

cw service python bot.py
cw service go run ./cmd/worker
```

### 11.4 Codex 실행 정책

Codex에게 다음 규칙을 제공한다.

```md
## Command execution policy

Do not run long-running commands directly.

Use:

- `cw job <command...>` for commands expected to finish.
- `cw preview <command...>` for browser-viewable web apps.
- `cw service <command...>` for long-running background services.
```

---

## 12. JobRunner 설계

### 12.1 담당 작업

* build
* test
* lint
* typecheck
* install
* format
* short script

### 12.2 동작

1. Job 생성
2. child process 실행
3. stdout/stderr 수집
4. SSE로 로그 전송
5. exit code 저장
6. 성공/실패 상태 갱신
7. 완료 후 Git 상태 refresh

### 12.3 timeout

Job은 기본 timeout을 둘 수 있다.

```text
Default timeout: 10 minutes
Install timeout: 30 minutes
Test timeout: configurable
```

---

## 13. PreviewManager 설계

### 13.1 목적

PreviewManager는 웹으로 볼 수 있는 장기 실행 dev server를 관리한다.

### 13.2 동작

1. preview 요청 수신
2. session cwd 검증
3. 포트 할당
4. 명령 실행
5. HOST/PORT 환경변수 주입
6. process registry 등록
7. reverse proxy 등록
8. healthcheck 수행
9. UI에 preview URL 제공

### 13.3 포트 정책

```text
Main app: 17321
Preview range: 17330 - 17399
Preview host: 127.0.0.1
External access: /preview/:sessionId/:previewId/
```

### 13.4 환경변수 주입

```ts
env: {
  ...process.env,
  HOST: "127.0.0.1",
  PORT: String(port),
  VITE_HOST: "127.0.0.1",
  VITE_PORT: String(port),
}
```

### 13.5 proxy

Frontend iframe은 직접 포트가 아니라 backend proxy URL을 본다.

```text
/preview/:sessionId/:previewId/
```

Backend는 이를 내부 주소로 proxy한다.

```text
http://127.0.0.1:<allocated-port>/
```

### 13.6 HMR

Vite, Next 등은 HMR에 WebSocket을 사용할 수 있다. reverse proxy는 HTTP뿐 아니라 WebSocket upgrade도 지원해야 한다.

---

## 14. ServiceManager 설계

### 14.1 목적

ServiceManager는 preview가 아닌 장기 실행 프로세스를 관리한다.

예:

* API server
* worker
* bot
* background daemon
* scheduler

### 14.2 Preview와 차이

Preview는 iframe URL이 있다. Service는 preview iframe이 없다.

Service는 다음 기능을 제공한다.

* logs
* status
* stop
* restart
* healthcheck

---

## 15. Codex 통합 설계

### 15.1 기본 구조

Codex는 backend에서 관리한다.

```text
React UI
  ↓
Express Backend
  ↓
@openai/codex-sdk / Codex CLI
```

브라우저에서 직접 Codex SDK를 사용하지 않는다.

### 15.2 세션 모델

각 프로젝트 session은 하나 이상의 Codex thread를 가질 수 있다.

```text
Project Session
  ├─ Codex Thread A
  ├─ Codex Thread B
  └─ Event Buffer
```

### 15.3 Codex 이벤트

Codex event는 SSE를 통해 UI로 전달한다.

### 15.4 Composer context

Composer의 `@` 파일/디렉토리 mention과 `$` skill mention은 Codex run 요청에 함께 전달한다. Backend는 mention path가 session cwd 내부인지 검증한 뒤 Codex에게 user-selected context로 제공한다.

### 15.5 Codex instruction

각 session cwd에 `AGENTS.md` 또는 동등한 instruction을 제공한다.

핵심 규칙:

* 장기 실행 명령 직접 실행 금지
* preview는 `cw preview` 사용
* build/test/lint는 `cw job` 사용
* service는 `cw service` 사용
* Git destructive action은 사용자 승인 전 실행 금지

---

## 16. FileManager 설계

### 16.1 기능

* 파일 트리 조회
* 파일 읽기
* 파일 저장
* 파일 생성
* 파일 삭제
* 파일명 변경
* 파일 변경 감지

### 16.2 path safety

모든 파일 경로는 session cwd 내부로 제한한다.

```ts
function safePath(root: string, input: string) {
  const resolved = path.resolve(root, input);
  const normalizedRoot = path.resolve(root);

  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new Error("Path escape blocked");
  }

  return resolved;
}
```

### 16.3 watcher

`chokidar`로 파일 변경을 감시한다.

감시 제외:

* node_modules
* .git/objects
* dist
* build
* target
* .next
* .venv

---

## 17. GitManager 설계

### 17.1 목적

GitManager는 Git 상태 조회와 안전한 Git 작업을 담당한다.

### 17.2 상태 조회

```bash
git status --porcelain=v2 --branch
```

이 결과를 파싱하여 다음을 제공한다.

* current branch
* detached 여부
* commit hash
* upstream
* ahead/behind
* staged changes
* unstaged changes
* untracked files

### 17.3 Branch 변경 감지

다음 방식들을 조합한다.

1. Codex run 종료 후 refresh
2. Git 명령 실행 후 refresh
3. `.git/HEAD` watcher
4. `.git/refs/heads/**` watcher
5. TanStack Query polling

### 17.4 Git UI 기능

MVP:

* status
* diff
* stage
* unstage
* commit
* push
* pull
* current branch 표시
* branch 생성
* branch 전환

후속:

* stash
* reset
* clean
* rebase
* cherry-pick
* conflict resolver

### 17.5 destructive action 정책

다음은 반드시 confirm이 필요하다.

* discard file
* reset hard
* clean untracked
* force push
* branch delete
* rebase abort/continue

MVP에서는 destructive action을 제외해도 된다.

---

## 18. Preview UX 설계

### 18.1 Preview Panel

Preview panel은 다음 요소를 포함한다.

* Start Preview 버튼
* Stop 버튼
* Restart 버튼
* Reload iframe 버튼
* Open external 버튼
* preview 상태
* logs shortcut

### 18.2 Preview URL

UI는 다음 URL을 iframe에 사용한다.

```text
/preview/:sessionId/:previewId/
```

### 18.3 여러 preview

한 session 안에서 여러 preview를 허용한다.

예:

* frontend dev server
* backend docs server
* storybook

UI에서는 preview selector를 제공한다.

---

## 19. Jobs UX 설계

### 19.1 Jobs Panel

Jobs panel은 다음을 표시한다.

* 실행 중인 job
* 최근 job history
* stdout/stderr log
* exit code
* duration
* rerun 버튼
* cancel 버튼

### 19.2 Codex와 연결

Codex가 작업 후 build를 요청하면 UI는 다음처럼 보여준다.

```text
Codex suggests running:

cw job bun run build

[Run] [Ignore]
```

또는 approval policy에 따라 자동 실행할 수 있다.

---

## 20. Security 설계

### 20.1 기본 보안 모델

이 앱은 로컬 개발 도구다. 기본적으로 private LAN 또는 localhost 사용을 전제로 한다.

### 20.2 listen host

기본은 localhost.

```text
host: 127.0.0.1
```

Termux에서 다른 기기로 접속하려면 사용자가 명시적으로 설정한다.

```bash
cw start --host 0.0.0.0
```

### 20.3 인증

LAN 공개 시 인증을 추가한다. 초기 placeholder였던 token 기반 인증은 보안 설계 확장에 따라 Telegram 승인 기반 browser session 인증으로 대체한다.

* `cw config telegram`으로 owner pairing
* `cw start --auth enable`로 Telegram approval 활성화
* `--auth`를 생략한 `cw start`는 인증을 비활성화한 상태로 실행
* UI 접속 시 Telegram 승인 요구
* HttpOnly session cookie와 CSRF token 사용

### 20.4 path escape 방지

File API와 Git API는 session cwd 밖 접근을 금지한다.

### 20.5 command execution 승인

명령은 세 종류로 나누고, 위험한 명령은 승인 필요로 분류한다.

* safe job
* preview
* service
* destructive shell command
* git destructive command

### 20.6 network exposure

Preview process는 기본적으로 `127.0.0.1`에만 bind한다. 외부 접근은 main Express proxy를 통해서만 허용한다.

### 20.7 Telegram 승인 기반 인증

Codex Web은 로컬 파일시스템, Git, Codex 실행, shell command, preview, service를 제어하는 개발 런타임이므로 외부 네트워크에 노출될 때는 원격 IDE 또는 원격 shell에 준하는 보안 모델을 적용한다.

`security-and-auth.md`는 Telegram 기반 인증, 승인, 단일 브라우저 세션, audit log, CSRF/Origin 방어, preview proxy 인증, 향후 Telegram remote control 확장을 정의하는 세부 설계 문서다. PRODUCT.md에서는 다음 제품 요구사항을 상위 명세로 둔다.

* `cw start --auth enable`은 Telegram 승인 기반 인증을 활성화한다.
* Telegram 인증을 사용하려면 사전에 `cw config telegram`으로 bot token 검증과 owner pairing을 완료해야 한다.
* 명시적 auth 활성화 상태에서 인증 설정이 불완전하면 server start를 중단한다.
* 웹 UI active browser session은 기본적으로 최대 1개만 허용한다.
* 새 browser session은 Telegram에서 승인하거나 기존 session replacement를 승인받아야 한다.
* 로그인 성공 시 backend가 HttpOnly, SameSite cookie 기반 session을 발급한다.
* state-changing API는 CSRF token과 Origin/Host 검증을 통과해야 한다.
* `/preview/*`, SSE, terminal WebSocket, command, Git, file, Codex API는 인증 대상이다.
* preview proxy는 등록된 PreviewManager target만 허용하고 arbitrary upstream proxy로 동작해서는 안 된다.
* audit log는 login request, 승인/거부, session replacement, logout, 위험 명령 승인, 인증 실패, Origin/CSRF 실패를 기록한다.
* Telegram remote control은 MVP 인증 이후 확장 기능으로 두며, Telegram에서 들어온 명령도 backend approval policy와 audit log를 통과해야 한다.

브라우저 보안 요구사항:

* session cookie는 JavaScript에서 읽을 수 없어야 한다.
* login complete token, CSRF token, session id는 URL query string에 노출하지 않는다.
* UI는 server-provided HTML/Markdown을 렌더링할 때 XSS 방어를 적용한다.
* iframe preview는 가능한 범위에서 sandbox와 같은 브라우저 격리 정책을 적용한다.
* WebSocket upgrade는 HTTP API와 동일한 인증/Origin 정책을 따른다.

### 20.8 Audit log

보안 이벤트는 `~/.codex-web/logs/audit.log`에 append-only JSON line 형식으로 기록한다. 민감값은 저장하지 않으며, token, cookie, bot token, CSRF secret, complete token은 log에 남기지 않는다.

예시 이벤트:

```text
auth.login.requested
auth.login.approved
auth.login.denied
auth.session.replaced
auth.logout
auth.failed
csrf.failed
origin.failed
command.approval.requested
command.approval.approved
```

### 20.9 Auth configuration

인증 설정은 민감 정보와 비민감 정보를 분리한다.

```text
~/.codex-web/config.json
~/.codex-web/secrets.json
~/.codex-web/logs/audit.log
```

`config.json`은 provider, single-session 정책, Telegram owner id 같은 비밀이 아닌 설정을 저장한다. `secrets.json`은 Telegram bot token, session secret, CSRF secret 같은 민감 정보를 저장하며 생성 시 파일 권한을 `0600`으로 제한한다.

환경변수는 secret 주입을 위해 허용한다.

```text
CW_TELEGRAM_BOT_TOKEN
CW_SESSION_SECRET
CW_CSRF_SECRET
```

---

## 21. PlatformAdapter 설계

### 21.1 목적

Termux/macOS/Linux/WSL 차이를 격리한다.

```ts
type Platform = "termux" | "linux" | "macos" | "wsl";

type PlatformAdapter = {
  platform: Platform;
  openUrl(url: string): Promise<void>;
  getDefaultProjectsDir(): string;
  getShell(): string;
  resolveBinary(name: string): Promise<string | null>;
  getHomeDir(): string;
};
```

### 21.2 Termux adapter

* home: `/data/data/com.termux/files/home`
* prefix: `/data/data/com.termux/files/usr`
* open URL: `termux-open-url` 또는 안내 출력
* package manager 안내: `pkg install`

### 21.3 macOS adapter

* open URL: `open`

### 21.4 Linux adapter

* open URL: `xdg-open`

### 21.5 WSL adapter

* Windows browser open 처리는 별도 adapter에서 처리

---

## 22. Doctor 설계

`cw doctor`는 환경 점검 명령이다.

### 22.1 체크 항목

* platform
* Bun 설치 여부
* Codex 설치 여부
* Git 설치 여부
* Python 설치 여부
* Go 설치 여부
* Rust 설치 여부
* port 17321 사용 가능 여부
* preview port range 사용 가능 여부
* Termux wake lock 안내
* storage permission 안내

### 22.2 출력 예시

```text
codex-web doctor

Platform: termux
Bun:      found
Codex:    found
Git:      found
Python:   found
Go:       missing
Rust:     missing
Port:     17321 available
Preview:  17330-17399 available

Warnings:
- Termux battery optimization may stop long-running sessions.
- Run termux-wake-lock for long-running work.
```

---

## 23. 데이터 저장

### 23.1 저장 위치

기본 저장 위치:

```text
~/.codex-web/
```

### 23.2 저장 내용

```text
~/.codex-web/
  config.json
  projects.json
  sessions.json
  logs/
  jobs/
  previews/
  services/
  cache/
```

### 23.3 config

```json
{
  "host": "127.0.0.1",
  "port": 17321,
  "previewPortStart": 17330,
  "previewPortEnd": 17399,
  "defaultProjectsDir": "~/projects",
  "activeProjectId": null,
  "recentProjectIds": [],
  "auth": {
    "enabled": false
  }
}
```

---

## 24. 이벤트 버스 설계

Backend 내부에서 EventBus를 사용한다.

### 24.1 역할

* Codex events broadcast
* job logs broadcast
* preview status broadcast
* git state updated broadcast
* file changed broadcast

### 24.2 session-scoped event

모든 event는 sessionId를 가진다.

```ts
type BaseEvent = {
  id: string;
  sessionId: string;
  timestamp: number;
  type: string;
};
```

---

## 25. Runtime Adapter 설계

### 25.1 목적

runtime별 preview/job/service 명령 보정을 담당한다.

### 25.2 BunAdapter

* `bun run build` → job
* `bun test` → job
* `bun run dev` → preview
* `bun run preview` → preview

Preview env:

```text
HOST=127.0.0.1
PORT=<allocated>
VITE_HOST=127.0.0.1
VITE_PORT=<allocated>
```

### 25.3 PythonAdapter

* `python -m pytest` → job
* `uvicorn main:app` → preview
* `streamlit run app.py` → preview
* `python bot.py` → service

Preview arg injection:

```text
uvicorn main:app --host 127.0.0.1 --port <allocated>
```

### 25.4 GoAdapter

* `go build ./...` → job
* `go test ./...` → job
* `go run ./cmd/web` → preview 또는 service

Preview는 env 기반을 우선 사용한다.

```text
HOST=127.0.0.1
PORT=<allocated>
```

### 25.5 RustAdapter

* `cargo build` → job
* `cargo test` → job
* `cargo run --bin web` → preview 또는 service

Preview는 env 기반을 우선 사용한다.

---

## 26. AGENTS.md 예시

```md
# Codex Web Runtime Policy

This project is managed by Codex Web.

## Commands

Do not run long-running commands directly.

Use:

- `cw job <command...>` for commands expected to finish.
- `cw preview <command...>` for browser-viewable web apps.
- `cw service <command...>` for long-running background processes.

Examples:

- `cw job bun run build`
- `cw job bun test`
- `cw job go test ./...`
- `cw job cargo build`
- `cw job python -m pytest`

- `cw preview bun run dev`
- `cw preview bun run preview`
- `cw preview uvicorn main:app`
- `cw preview go run ./cmd/web`
- `cw preview cargo run --bin web`

- `cw service python bot.py`
- `cw service go run ./cmd/worker`

## Git

Do not run destructive Git commands without explicit user approval.

Require approval for:

- reset --hard
- clean -fd
- force push
- branch delete
- rebase

## Preview

Preview processes must be started through `cw preview` so the UI can track ports, logs, process IDs, and iframe URLs.
```

---

## 27. MVP 범위

### 27.1 포함

* `cw start`
* React UI shell
* workspace settings
* project 추가/선택/최근 목록
* session 생성
* file tree
* Monaco editor read/write
* Codex chat/run
* composer `@` 파일/디렉토리 mention
* composer `$` skill mention
* SSE event stream
* `cw job`
* `cw preview`
* Preview iframe
* Git state/status/diff
* stage/unstage/commit
* current branch 표시
* Codex run 종료 후 git refresh
* `.git/HEAD` watcher
* `cw doctor`

### 27.2 제외

* Android native wrapper
* terminal emulator
* conflict resolver
* multi-user auth
* cloud sync
* plugin system
* full shim layer
* destructive Git operations

---

## 28. v1 이후 기능

### 28.1 Terminal

* xterm.js
* PTY backend
* WebSocket 필요

### 28.2 Android wrapper

* WebView
* Termux RUN_COMMAND intent
* foreground service
* start/stop/status

### 28.3 Advanced Git

* stash
* branch graph
* conflict resolution
* rebase UI

### 28.4 Plugin System

* custom runtime adapter
* custom job templates
* custom preview templates

### 28.5 Remote Access

* Tailscale integration guide
* Cloudflare Tunnel guide
* Telegram approval auth

---

## 29. 구현 순서

### Phase 1: CLI + Server Skeleton

1. monorepo 구성
2. Bun 기반 CLI 작성
3. Express server 작성
4. React static serve
5. `cw start` 구현
6. `cw doctor` 구현

### Phase 2: Session + File UI

1. WorkspaceManager
2. Project 추가/선택
3. SessionManager
4. FileManager
5. safe path 처리
6. file tree UI
7. Monaco editor
8. file read/write

### Phase 3: Codex Integration

1. CodexSessionManager
2. Codex run API
3. SSE stream
4. event buffer
5. Codex chat UI
6. composer `@` file/directory mention
7. composer `$` skill mention

### Phase 4: Command System

1. CommandManager
2. JobRunner
3. `cw job`
4. Jobs panel
5. stdout/stderr streaming

### Phase 5: Preview System

1. PortAllocator
2. PreviewManager
3. `cw preview`
4. reverse proxy
5. iframe preview
6. logs/status/restart

### Phase 6: Git System

1. GitManager
2. git state parsing
3. git status UI
4. diff viewer
5. stage/unstage
6. commit
7. branch 표시
8. `.git/HEAD` watcher

### Phase 7: Hardening

1. Telegram approval auth baseline
2. command approval
3. destructive action confirm
4. config persistence
5. platform adapter refinement
6. Termux battery/wake-lock guide

### Phase 8: Auth and Browser Security

1. `cw config telegram`
2. Telegram bot token validation
3. Telegram owner pairing
4. `cw start --auth enable`
5. Telegram login approval
6. single browser session enforcement
7. session heartbeat and replacement approval
8. HttpOnly session cookie
9. CSRF token and Origin/Host validation
10. authenticated preview proxy and terminal WebSocket
11. audit log
12. browser XSS and iframe hardening
13. `cw auth status`
14. `cw auth logout-all`

---

## 30. 최종 요약

이 프로젝트는 Android native 앱이 아니라 Termux 기반 로컬 개발 런타임 위에 웹 UI를 얹는 구조가 가장 적합하다.

핵심 아키텍처는 다음과 같다.

```text
Termux = runtime engine
Express = local app server
React = UI
Codex = coding agent
CommandManager = execution boundary
PreviewManager = managed web preview
GitManager = Git workflow layer
cw CLI = installable launcher
```

가장 중요한 설계 결정은 다음이다.

1. Codex가 장기 실행 명령을 직접 실행하지 않게 한다.
2. 모든 명령은 `cw job`, `cw preview`, `cw service`로 분류한다.
3. Preview는 포트 스캔으로 추측하지 않고 PreviewManager가 직접 생성한다.
4. Git 상태는 backend가 읽고 UI는 subscribe/refetch한다.
5. Termux-first로 만들되 POSIX 환경 전체로 확장 가능하게 한다.
6. UI는 Codex App과 `./ui-example.jpg`를 기준으로 한다.

이 설계대로 구현하면 Android 태블릿에서는 네이티브 앱 같은 로컬 IDE 경험을 제공하고, 동시에 macOS/Linux/WSL에서도 거의 동일한 방식으로 사용할 수 있다.
