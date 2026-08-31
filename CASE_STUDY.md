# Omnia engineering case study

## Context

Omnia is a desktop shell for third-party web applications. The visible product
looks like a sidebar and a set of panes, but the difficult work happens at the
boundaries between React, Electron's native view hierarchy, remote identity and
route services, and pages that Omnia does not control.

This document describes the hardest problems visible in the repository and the
implemented solutions. It does not claim performance gains, user growth, or
benchmark results that the project has not measured.

## 1. Making native web views behave like React layout children

### Problem

An iframe would be easy to position in React, but many modern applications need
a full browser context, persistent cookies, popups, media, and service-specific
navigation behavior. Omnia therefore uses an Electron `WebContentsView` for
each route.

Those views are not DOM nodes. React cannot size, stack, mount, or unmount them
directly, and the native view layer can cover renderer content. The application
still needs three layouts, route switching, route hibernation, and management
UI that remains usable above the hosted page.

### Solution

The renderer owns layout intent while the main process owns native resources:

1. [`Window.tsx`](src/renderer/components/Window.tsx) and
   [`SpreadWindows.tsx`](src/renderer/components/SpreadWindows.tsx) render empty
   DOM containers and measure their actual bounds.
2. `ResizeObserver`, animation-frame scheduling, and main-window resize events
   send rounded rectangles over scoped IPC.
3. [`registerIpcHandlers.ts`](src/main/ipc/registerIpcHandlers.ts) attaches the
   correct native view and applies the renderer's bounds. Single mode removes
   sibling views; spread and matrix modes position every active route.
4. [`windows/index.ts`](src/main/windows/index.ts) holds the view map and route
   runtime state. Hibernation closes a view but keeps its persistent session;
   deletion closes it and clears its partition.
5. Create/manage/settings UI runs in a frameless child `BrowserWindow`. The
   shell renderer publishes a complete `DrawerStateSnapshot`; main relays
   mutations between the child renderer, native views, and shell renderer.

This keeps React declarative for layout without pretending that native views
are normal React children.

### Trade-offs and remaining risk

- Bounds and state cross a process boundary, so stale measurements and event
  ordering are explicit concerns.
- Drawer state exists in the shell renderer, main process, and drawer renderer;
  the snapshot protocol reduces ambiguity but does not eliminate duplication.
- Each active route retains a Chromium renderer cost. Hibernation is a manual
  resource-control mechanism, not a free optimization.
- Component tests cover renderer-side layout requests and state behavior. The
  native-view choreography is still verified manually because there is not yet
  a packaged Electron end-to-end layout test.

## 2. Bootstrapping authentication without stale-session flashes

### Problem

Authentication state is persisted, so startup cannot equate "a token exists"
with "the session is valid." A token may be near expiry, a refresh may rotate
both tokens, the route API may be temporarily unavailable, or an old async
request may finish after the component has unmounted. Rendering the workspace
too early can expose stale state; clearing it on every network error makes the
offline cache useless.

### Solution

The flow separates policy from React orchestration:

- [`authApi.ts`](src/main/authApi.ts) performs OpenID Connect discovery and
  Authorization Code with S256 PKCE in main. It creates random state/verifier
  values, validates the exact callback protocol/host/path and state, and keeps
  access tokens out of the hosted auth window.
- Network calls use a 20-second timeout. Discovery and startup route loading
  have bounded retries, and a failed discovery promise is evicted so one
  transient failure does not poison the process lifetime.
- [`sessionVerification.ts`](src/renderer/sessionVerification.ts) contains the
  decision logic: refresh within a one-minute expiry window, validate the user,
  load and sort routes, select a valid active route, or classify a failure.
- [`useSessionVerification.ts`](src/renderer/hooks/useSessionVerification.ts)
  owns timers and mounted-state guards. It retries an offline workspace every
  15 seconds and immediately when the browser reports that the network is back.
- Refresh failures that retain a 400/401 status clear the session. A temporary
  or unclassified failure may use cached routes only when both a cached
  workspace and user exist.

The authentication loader remains visible until the initial decision is
complete, preventing the sign-in screen from briefly replacing a session that
is still being verified.

### Trade-offs and remaining risk

- Offline means "the workspace configuration is cached," not that hosted pages
  work without a network connection.
- Access and refresh tokens are persisted in renderer localStorage. A stronger
  design would move refresh credentials to an OS-backed secret store and keep
  token ownership in main.
- Authentik discovery is currently fixed to the hosted instance, so changing
  identity providers requires a code/configuration extension.
- Errors returned by `auth-me` are not yet normalized into the renderer's typed
  authentication error, so a revoked token outside the refresh window can be
  misclassified as a temporary outage when cached workspace data exists.
- The policy is well covered by deterministic tests, while the real hosted OIDC
  round trip remains a manual integration check.

## 3. Reconciling unread state from pages Omnia does not control

### Problem

There is no single unread API shared by Gmail, Telegram, chat applications, and
arbitrary web pages. Titles sometimes include a count, DOM badges vary by
provider and locale, and Telegram can publish a badge through a browser API.
Updates may arrive from several sources in an unpredictable order.

A naive "last update wins" implementation lets a weak title guess overwrite a
more precise DOM signal. Recreating a view can also let an old event race with a
new state snapshot.

### Solution

[`unreadTracker.ts`](src/main/windows/unreadTracker.ts) generates a small page
script and parses only messages with Omnia's private prefix. The injected code
combines:

- generic title parsing;
- Gmail-specific title and DOM strategies;
- Telegram App Badge interception;
- a `MutationObserver` with debounced reads; and
- periodic polling as a recovery path for missed DOM changes.

The main process stores one entry per route and assigns source priority:
Telegram's badge source outranks service-specific DOM sources, which outrank a
generic title. It normalizes counts, ignores identical updates, increments a
revision, and publishes a full snapshot as well as incremental events.

[`Sidemenu.tsx`](src/renderer/components/Sidemenu.tsx) requests the current
snapshot when it mounts and ignores revisions older than the latest applied
state. The same total updates the document title and the platform application
badge through [`appUnreadBadge.ts`](src/main/windows/appUnreadBadge.ts).

### Trade-offs and remaining risk

- This avoids storing provider API credentials, but DOM and title rules are
  inevitably coupled to third-party implementation details.
- Polling and mutation observation add small continuous work to each active
  route.
- Prefix parsing and platform badge behavior are unit-tested. Source-priority
  arbitration and live provider pages are not contract-tested and can still
  change without notice.

## 4. Defining a trust boundary for arbitrary hosted applications

### Problem

Every route loads remote code. That code must not receive Node access, arbitrary
Electron IPC, unrestricted permission grants, or the ability to turn every
navigation into an in-app trusted page. At the same time, real login flows need
selected related hosts and, for a small set of services, OAuth popup windows.

### Solution

The project applies several independent controls:

- Shell, drawer, auth, and route views disable Node integration and use context
  isolation; the auth window additionally enables Electron sandboxing.
- [`preload.ts`](src/preload.ts) exposes three narrow operations and rejects IPC
  channel names outside a fixed allowlist.
- [`routeMapping.ts`](src/common/routeMapping.ts) maps known integrations to
  explicit internal hosts. [`isExternalUrl.ts`](src/common/utils/isExternalUrl.ts)
  uses boundary-safe hostname matching and unwraps common redirect parameters.
- Main sends navigation outside the route policy to the system browser. Google
  OAuth popups are allowed only for the integrations that require that path and
  reuse the route's isolated session.
- Permission check/request handlers allow only media and notifications from
  HTTPS route origins, with a narrow HTTP exception when the configured route
  itself uses a loopback host.
- Forge packages into ASAR and flips fuses that disable RunAsNode, Node options,
  and CLI inspection while requiring embedded ASAR integrity validation.

### Trade-offs and remaining risk

- Host policies are static application knowledge and need maintenance when
  providers add authentication domains.
- The IPC channel allowlist limits reachability, but payloads are not yet
  validated with runtime schemas and the TypeScript bridge is generic rather
  than channel-specific.
- Tokens are still renderer-persisted, and the main renderer does not yet define
  a Content Security Policy.

## Validation strategy

The repository's automated quality path is:

```text
ESLint -> TypeScript -> Vitest with coverage -> CRAP threshold 8 -> package
```

Focused tests exercise session decisions, URL boundaries, route mapping,
unread parsers and badge output, route API errors, and renderer component
behavior. A manual native smoke test uses `npm start` and the hosted identity
and route services; it is not a substitute for future packaged Electron E2E
tests or live provider contract monitoring.
