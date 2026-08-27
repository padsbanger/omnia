# Omnia design

## Purpose

Omnia is a desktop workspace that hosts several web applications in one
Electron window. Each configured application is a **route**: it has a display
name, icon, URL, and a dedicated Electron session partition so its login state
is isolated from other routes.

## Architecture

```text
React renderer ── typed application messages ──> preload bridge ──> Electron main
     │                                                      │
     │ Zustand + local storage                               ├─ BrowserWindow (shell)
     │                                                       ├─ WebContentsView per route
     └─ UI: sidebar, layouts, route and drawer controls      └─ Authentik + Omnia API
```

The processes have separate responsibilities:

- **Renderer** (`src/renderer/`) owns the React interface, client-side route
  selection, layouts, and persisted UI/auth state.
- **Preload** (`src/preload.ts`) exposes a restricted `window.electronAPI`
  bridge. It allows only explicitly listed IPC channels.
- **Main process** (`src/main.ts`, `src/main/`) owns native windows, embedded
  browser views, sessions, permissions, IPC handlers, unread tracking, and
  server-side HTTP requests.
- **Shared code** (`src/common/`) defines route and drawer models plus utilities
  used by both renderer and main processes.

## Main workspace

The main `BrowserWindow` contains the React shell and a persistent side menu.
Route content is not rendered in an iframe: the main process creates an
Electron `WebContentsView` for each active route and positions it beside the
side menu. This lets each integration retain an independent partition, browser
state, and Chromium process.

The main layout has three modes:

- `single`: the selected route occupies the content area.
- `spread`: route views are laid out side by side.
- `matrix`: route views are arranged in a grid.

Routes can be hibernated to close their `WebContentsView` and reclaim memory.
Restoring one recreates it from the route configuration. Deleting a route also
clears that route's session storage; hibernating it preserves the session.

## Drawers

Create, manage, and settings experiences run in a small, frameless child
`BrowserWindow` rather than inside the main React tree. The window is loaded
with a `?drawer=` query parameter and is positioned next to the side menu.

The renderer sends a `DrawerStateSnapshot` whenever drawer-related state
changes. The main process keeps that snapshot, creates or updates the drawer
window, and sends mutation results back to the main renderer. This permits the
drawer and workspace to remain independent renderer instances while sharing a
single source of runtime truth.

## State and synchronization

Zustand stores persist the app and authentication state in renderer local
storage:

- `appStore` retains routes, selected route, sidebar state, layout, and offline
  workspace data. Unread counts, drawer state, offline state, and per-route
  memory measurements are intentionally not persisted.
- `authStore` retains the access token, refresh token, and current user after
  hydration.

At startup, `AuthGate` validates or refreshes the session, then loads routes
from the Omnia API and maps them into the local route model. If the backend is
temporarily unavailable and a cached workspace plus user are available, the
user may continue in offline mode; the app retries when the network returns.

The main process holds runtime-only state: instantiated route views, per-route
unread counts, current audio status, memory usage, and drawer-window state. It
publishes changes to the renderer over IPC.

## Authentication and remote data

Authentication uses Authentik OpenID Connect with Authorization Code + PKCE.
The main process opens a modal sign-in window, verifies the custom redirect
URI, exchanges the code, and queries the user-info endpoint. Renderer code
never calls identity or route APIs directly; it invokes main-process handlers.

The Omnia backend is the source of truth for route creation, updates, ordering,
and deletion. The renderer fetches routes after session validation and keeps a
local cached representation for offline use.

## Security model

- Main, drawer, and route views use context isolation; Node integration is
  disabled.
- The preload bridge validates IPC channel names before forwarding calls.
- Every route uses its configured session partition, preventing login cookies
  from leaking across integrations.
- Route permission requests are limited to media and notifications and are
  granted only to trusted HTTPS origins associated with the route.
- Navigation outside a route's allowed internal hosts is redirected to the
  system browser. OAuth popups are allowed only for specifically supported
  route types.

## Observability and integration behavior

Route views emit unread activity from page titles and injected DOM trackers.
The main process prefers more specific sources over generic title parsing,
updates the application badge, and sends the result to the renderer. Route
memory usage is collected after load and then every 15 seconds so the UI can
surface resource consumption.

## Design constraints

- Changes crossing process boundaries must add a deliberately scoped preload
  channel and a matching main-process handler.
- Keep shared route and drawer contracts in `src/common/`.
- Do not expose arbitrary Electron APIs, URLs, or IPC methods to renderer code.
- Preserve each route's session partition and navigation policy when extending
  integrations.
