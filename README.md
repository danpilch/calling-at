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

## Notes

Brand colours/typography are placeholders derived from the (trademarked) National Rail app and
are pending a reskin. The header font uses locally-installed Georgia and is not bundled.
