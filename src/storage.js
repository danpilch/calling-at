// Favourite + recent stations, persisted in localStorage. Each entry is { crs, name }.
// No backend — this is the whole "My Travel" data layer.
const FAV_KEY = 'callingat.favourites'
const RECENT_KEY = 'callingat.recents'
const PINNED_KEY = 'callingat.pinned'
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

// Pinned service: a single "track this train" slot (the original app pinned one
// service at a time). Shape: { serviceId, label, expiresAt }. It auto-expires
// once the train should have arrived so a stale pin doesn't linger forever.
export function getPinned() {
  try {
    const v = JSON.parse(localStorage.getItem(PINNED_KEY))
    if (!v || typeof v !== 'object' || !v.serviceId) return null
    if (v.expiresAt && Date.now() > v.expiresAt) {
      clearPinned()
      return null
    }
    return v
  } catch {
    return null
  }
}

export function isPinned(serviceId) {
  const p = getPinned()
  return !!p && p.serviceId === serviceId
}

export function setPinned(pin) {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(pin))
  } catch {
    // storage full or unavailable — pin just won't persist
  }
}

export function clearPinned() {
  try {
    localStorage.removeItem(PINNED_KEY)
  } catch {
    // ignore
  }
}
