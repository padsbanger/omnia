# Omnia contributor guide

## Project overview

Omnia is an Electron desktop app with a React renderer, built through Electron
Forge and Vite. TypeScript is used throughout the application.

## Repository layout

- `src/main.ts` and `src/main/`: Electron main-process lifecycle, windows, and
  IPC handlers.
- `src/preload.ts`: the narrowly scoped bridge exposed to renderer code.
- `src/renderer/`: React UI, feature API clients, and Zustand stores.
- `src/common/`: types, route definitions, settings, and utilities shared by
  main and renderer processes.
- `src/assets/`: packaged application assets.

## Working conventions

- Keep main-process, preload, and renderer responsibilities separated. New
  renderer access to Electron capabilities should be exposed deliberately via
  `src/preload.ts` and handled through IPC in `src/main/ipc/`.
- Put code needed by more than one process in `src/common/`; do not import
  renderer modules from the main process or vice versa.
- Preserve TypeScript types and avoid `any`; `noImplicitAny` is enabled.
- Follow the existing component, store, and API organization in
  `src/renderer/` for UI work.
- Never commit secrets. Create a local `.env` from `.env.example` for
  development configuration.

## Style

Formatting is defined by `.prettierrc`: two spaces, single quotes, semicolons,
trailing commas, 80-character lines, and LF endings. Match nearby code and
keep changes focused.

## Verification

Run the relevant checks after changes:

```powershell
npm run lint
npm start
```

Use `npm start` for an interactive Electron smoke test. Packaging work can be
validated with `npm run package` or `npm run make` when appropriate.
