import { useEffect, useState } from 'react'

// Hash-based routing: deep links work on a static host (GitHub Pages) with no
// server config, and the URL is the single source of truth for the main view.
// Routes: /live/:crs/:mode[/to/:filter] · /journeys[/:from/:to] · /service/:id
//         · /search · /mytravel · /more
export function getHash() {
  return window.location.hash.replace(/^#/, '') || '/'
}

// Push a new entry (Back returns to the previous view).
export function navigate(path) {
  window.location.hash = path
}

// Replace the current entry (no Back step) — for normalising or swapping a
// transient view (e.g. search) out of history once a destination is chosen.
export function replace(path) {
  const base = window.location.pathname + window.location.search
  window.history.replaceState(null, '', `${base}#${path}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function segments(hash) {
  return hash.split('/').filter(Boolean).map(decodeURIComponent)
}

export function useRoute() {
  const [hash, setHash] = useState(getHash())
  useEffect(() => {
    const on = () => setHash(getHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}
