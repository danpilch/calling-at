# Calling At

Live UK train departure & arrival boards — a 100% client-side web app, no backend.

Built with Vite + React. Live data comes from a public [Huxley2](https://github.com/jpsingleton/Huxley2)
instance (a CORS-enabled JSON proxy for the National Rail Darwin LDBWS API); the base URL is in
`src/api.js` and is a one-line swap to self-host.

## Develop

Uses [Bun](https://bun.sh) (pinned in `.tool-versions` for asdf):

```bash
bun install
bun run dev      # http://localhost:5173/
bun run build    # production build -> dist/
```

## Deploy

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
In the repo settings, set **Pages → Build and deployment → Source: GitHub Actions** once.
Served at `https://danpilch.github.io/calling-at/` (the `base` in `vite.config.js`).

## Features

- Live departure / arrival boards with a station picker over ~2,900 UK stations.
- Auto-refresh every 30s.
- Service detail with a full calling-points timeline and current train position.
- **"Calling at" filter** — show only departures that serve a chosen station.
- **Journeys** — direct A→B trains with departure/arrival times and duration.
- **My Travel** — favourite & recent stations, saved in `localStorage`.
- **Nearest stations** — find the closest stations using browser geolocation.
- **Shareable links** — the URL captures the current view (board, journey, service),
  so any screen can be bookmarked or shared.
- **Installable PWA** — works offline (app shell) and installs to a home screen.

## Install (PWA)

Calling At is a Progressive Web App: it can be installed like a native app and the
shell works offline (live train data still needs a connection). After visiting
`https://danpilch.github.io/calling-at/`:

- **iPhone / iPad (Safari):** tap the **Share** button → **Add to Home Screen**.
- **Android (Chrome):** tap the **⋮** menu → **Install app** (or **Add to Home screen**).
- **Desktop (Chrome / Edge):** click the **install icon** (⊕) in the address bar, or
  **⋮ menu → Install Calling At…**.

Once installed it launches full-screen with its own icon. A
[service worker](public/sw.js) caches the app shell and station list
(stale-while-revalidate); the live Huxley API is never cached, so train times are
always fresh when online.

### Icons

App icons are generated from the source SVGs in `public/` with
[`rsvg-convert`](https://gitlab.gnome.org/GNOME/librsvg) (librsvg):

```bash
cd public
rsvg-convert -w 192 -h 192 icon.svg          -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg          -o icon-512.png
rsvg-convert -w 512 -h 512 icon-maskable.svg -o icon-maskable-512.png   # Android safe-zone padded
rsvg-convert -w 180 -h 180 icon.svg          -o apple-touch-icon.png
```

## Notes

Brand colours/typography are placeholders derived from the (trademarked) National Rail app and
are pending a reskin. The header font uses locally-installed Georgia and is not bundled.
