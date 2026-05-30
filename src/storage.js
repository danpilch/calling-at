// Favourite + recent stations, persisted in localStorage. Each entry is { crs, name }.
// No backend — this is the whole "My Travel" data layer.
const FAV_KEY = 'callingat.favourites'
const RECENT_KEY = 'callingat.recents'
const RECENT_MAX = 8

function read(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function write(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // storage full or unavailable — fail silently, favourites just won't persist
  }
}

export function getFavourites() {
  return read(FAV_KEY)
}

export function isFavourite(crs) {
  return read(FAV_KEY).some((s) => s.crs === crs)
}

// Toggle and return the new list so callers can update state in one step.
export function toggleFavourite(station) {
  const list = read(FAV_KEY)
  const next = list.some((s) => s.crs === station.crs)
    ? list.filter((s) => s.crs !== station.crs)
    : [...list, { crs: station.crs, name: station.name }]
  write(FAV_KEY, next)
  return next
}

export function clearFavourites() {
  write(FAV_KEY, [])
}

export function getRecents() {
  return read(RECENT_KEY)
}

export function clearRecents() {
  write(RECENT_KEY, [])
}

// Most-recent-first, de-duplicated by CRS, capped at RECENT_MAX.
export function addRecent(station) {
  const entry = { crs: station.crs, name: station.name }
  const next = [entry, ...read(RECENT_KEY).filter((s) => s.crs !== entry.crs)].slice(0, RECENT_MAX)
  write(RECENT_KEY, next)
  return next
}
