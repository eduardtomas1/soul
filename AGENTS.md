# Working in Soul

Soul is a local-first Electron desktop app for logging one person's days:
routines, habits, a daily journal, personal measures and money. This file is the repository guide for coding agents and contributors.
The README is for people who use the app and stays non-technical.

## Map

- `src/main`: the privileged Electron main process. Owns SQLite, the filesystem,
  the keychain-backed secret store, Google Drive, provider processes and
  desktop notifications.
  - `database`: opener, pragmas and append-only migrations.
  - `repositories`: one module per domain, plain functions over prepared statements.
  - `services`: composition over repositories. `days.ts` builds the per-day
    summaries and the day log that the Overview, Journal and charts share;
    `today.ts`, `medals.ts` and `csv-import.ts` sit on top.
  - `backup`, `drive`, `assistant`, `reminders`: the four side-effecting subsystems.
  - `features/*-handlers.ts`: IPC handlers, one call each.
- `src/preload`: the only bridge into the renderer. It forwards known channel
  names and nothing else.
- `src/shared`: zod contracts and pure domain math shared by both processes.
  `ipc.ts` is the single typed list of channels; adding a channel there forces
  a handler in main and gives the renderer its types.
- `src/renderer`: the React interface. It never touches Node, the database or
  the filesystem; it only calls `invoke` from `lib/bridge.ts`.
  - `components`: shared building blocks. `primitives.tsx` has `Panel`,
    `Metrics`, `Columns`, `Stack` and the form controls; `tabs.tsx` has the
    sliding `Tabs` and `Segmented`; `kpi.tsx` the key-figure cards;
    `charts/*` the SVG charts (line, column, sparkline, progress, heatmap,
    breakdown); `day-nav.tsx` the day picker. Screens are composed from these
    rather than one-off styles.
  - `features/<area>`: one folder per screen, split into small modules
    (for example `finances/editors/*`, `settings/*-section.tsx`).
    `features/log` is the Quick Log window (Ctrl+L) that logs into every module.
  - `lib`: bridge, queries, settings, navigation, the clock (`usePickedDay`
    follows today unless a past day is chosen), `motion.ts` (count-up and the
    reduced-motion check), `escape.ts` and `focus-trap.ts` (only the topmost
    dialog handles Escape and Tab, and focus returns to where it was) and
    `flush.ts` (edits still waiting to be saved are written when the window
    closes).
- `tests`: vitest tests for the domain math, repositories, services and main-process
  helpers. Checks run locally.
- `.github/workflows/release.yml`: tag-triggered native packaging and release upload, without test CI.
- `scripts`: demo data, the README screenshot capture and the icon render.

## Conventions

- TypeScript strict everywhere, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- No comments in code. Names and small functions carry the meaning.
- Every IPC payload is validated with zod in `src/main/ipc.ts` before a handler
  runs. Handlers return plain data; errors become `{ ok: false, error }`.
- Money is euros stored as integer cents. Dates are `YYYY-MM-DD` strings in
  local time. Weeks start on Monday and weekday `0` is Monday.
- Migrations are append-only. Never edit a released migration; add a new one.
- Text search is case and accent insensitive through the `soul_fold` SQL
  function that `database/open.ts` registers on every connection.
- Secrets (Google client, refresh token, backup passphrase) live in
  `secrets.json` encrypted with Electron `safeStorage`. They are never stored in
  the SQLite database, so a backup never contains them.
- Spawn provider executables without a shell, with bounded output and a
  cancellable lifecycle. Provider output is untrusted text.
- Motion uses transform, opacity and stroke drawing only, lives in the
  animation classes of `styles/app.css` plus `useCountUp`, and never runs
  continuously. Settings can turn it off, and it follows the system's reduced
  motion setting. No polling loops in either process.
- Icons come from Phosphor. Stored icon keys map to Phosphor icons in
  `src/renderer/src/lib/glyphs.ts`; the picker hides keys that share an icon.
- Themes: light, dark and natural (warm paper, walnut text, forest green and a
  sand sidebar). Every colour is a token in `styles/app.css`; charts use
  `--signal` and `--series-2`, a pair checked for colour-blind separation and
  contrast in each theme.
- Design: an ink sidebar, a light grey canvas with white bordered panels,
  IBM Plex Sans (bundled), sentence-case text with small capitals only for
  table headers and figure labels, tables (`data-table`) for records, and one
  signal blue for data and focus. Other colour only carries meaning: category
  and item tones, positive and negative amounts, a measure moving the way its
  owner chose (higher or lower is better), going over budget. Key-figure rows switch to two columns when their
  container is narrower than 860 px, and layouts stack below 1180 px wide.
- Journal notes, measures and every other record stay local. The assistant
  gets journal notes only through its read-only tool when a question needs them.

## Commands

```sh
npm ci          # Node 22
npm run dev     # Electron with hot reload
npm run check   # lint, typecheck, tests
npm run build   # production bundle in out/
npm run dist:mac | dist:win | dist:linux
npm run screenshots   # rebuilds and captures docs/screenshots under Xvfb or a display
```

Set `SOUL_DATA_DIR` to run against a throwaway data directory.

`better-sqlite3` ships prebuilt binaries for every release platform, but npm still
tries to compile it. On Windows without Visual Studio Build Tools, install with
`npm ci --ignore-scripts`, then run `node node_modules/electron/install.js`, and
package locally with `-c.npmRebuild=false`.

## Releases

Keep `package.json` and `package-lock.json` versions aligned, run `npm run check`,
build and launch a package with disposable data, and update `docs/release-notes.md`.
Merge the release source before pushing its matching `v<version>` tag. Tags and
published assets are immutable; use a new version for a published correction.
The release workflow packages each architecture on its native OS and CPU, then
publishes all six installers with `SHA256SUMS`. Failed builds publish nothing.
Mac builds use ad-hoc signing without notarization; Windows builds are unsigned.
Provider CLIs are discovered on the user's machine and are not bundled.
