# SGM Desktop (Electron + React)

Desktop client for SGM operations.  
It is used by internal staff to manage tramites and servicios end-to-end against the SGM backend API.

## What This App Does

- Authenticates users and keeps session state in the desktop app.
- Shows the main tray of tramites with filters and detail view.
- Creates new tramites with required invoice PDF.
- Manages tramite lifecycle:
  - state changes
  - checklist and file uploads
  - payments
  - shipment links
  - account statement PDF download
- Manages non-matricula servicios:
  - create from templates
  - edit service data
  - track service states
  - record service payments
- Displays overdue workflows and business reports.

## Stack

- Electron (desktop shell)
- React 18 + TypeScript
- Vite
- TanStack Query
- Ant Design
- Axios

## Security Notes

- Electron renderer runs with `contextIsolation`, `sandbox`, and `webSecurity`.
- New windows and external navigation are blocked by default from main process.
- Auth token is stored in Electron main process and encrypted when platform encryption is available.
- Mock mode defaults to `off` to avoid silent fallback to fake data in production use.

## Project Structure

- `src/` React application (routes, pages, API clients)
- `electron/` Electron main process + preload + IPC auth bridge
- `public/` static assets

## Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Variables:

- `VITE_API_BASE_URL` backend base URL
- `VITE_USE_MOCKS` legacy toggle (kept for compatibility)
- `VITE_MOCK_MODE` one of `off | auto | force`

## Install

```bash
npm install
```

## Run

```bash
# web renderer only
npm run dev

# electron + renderer
npm run electron:dev
```

## Build

```bash
# web build
npm run build

# electron main build
npm run electron:build
```

## Package Windows App

```bash
# nsis installer
npm run dist:win

# portable exe
npm run dist:portable
```

Artifacts are generated in `release/`.

## Notes

- If Electron does not open and exits instantly in your shell, verify `ELECTRON_RUN_AS_NODE` is not set.
- The app expects the backend API documented in the `SGM-Backend` repository.
