import { useEffect, useMemo, useRef, useState } from 'react'
import { getStations } from './api.js'

// Great-circle distance in km between two lat/lng points.
function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)

// Full-screen station search overlay. Filters the ~2,900-station list by
// name or CRS; exact 3-letter CRS matches and name-prefix matches rank first.
// Also offers "stations near me" via browser geolocation + station lat/lng.
export default function StationSearch({ onPick, onClose }) {
  const [stations, setStations] = useState(null)
  const [q, setQ] = useState('')
  const [near, setNear] = useState(null) // [{...station, km}] | null
  const [geoState, setGeoState] = useState('idle') // 'idle' | 'locating' | 'error'
  const inputRef = useRef(null)

  useEffect(() => {
    getStations().then(setStations).catch(() => setStations([]))
    inputRef.current?.focus()
  }, [])

  function findNearby() {
    if (!navigator.geolocation || !stations) { setGeoState('error'); return }
    setGeoState('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const ranked = stations
          .filter((s) => s.lat != null)
          .map((s) => ({ ...s, km: distanceKm(coords.latitude, coords.longitude, s.lat, s.lng) }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 15)
        setNear(ranked)
        setGeoState('idle')
        setQ('')
      },
      () => setGeoState('error'),
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  const results = useMemo(() => {
    if (!stations) return []
    const term = q.trim().toLowerCase()
    if (!term) return stations.slice(0, 50)
    const scored = []
    for (const s of stations) {
      const name = s.name.toLowerCase()
      const crs = s.crs.toLowerCase()
      let score = -1
      if (crs === term) score = 0
      else if (name.startsWith(term)) score = 1
      else if (name.includes(' ' + term)) score = 2
      else if (name.includes(term)) score = 3
      else if (crs.startsWith(term)) score = 4
      if (score >= 0) scored.push([score, s])
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    return scored.slice(0, 50).map((x) => x[1])
  }, [stations, q])

  function pickFirst(e) {
    e.preventDefault()
    if (results[0]) onPick(results[0])
  }

  return (
    <div className="overlay">
      <header className="hdr">
        <button className="hdr-back" onClick={onClose} aria-label="Close search">&#8592;</button>
        <h1>Find a station</h1>
      </header>
      <form className="search-bar" onSubmit={pickFirst}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); if (e.target.value) setNear(null) }}
          placeholder="Station name or CRS code"
          aria-label="Search stations"
        />
        <button type="button" className="geo-btn" onClick={findNearby} disabled={geoState === 'locating' || !stations}>
          {geoState === 'locating' ? 'Locating…' : '◎ Stations near me'}
        </button>
      </form>
      <div className="search-list">
        {stations === null && <div className="muted pad">Loading stations…</div>}
        {geoState === 'error' && (
          <div className="muted pad">Couldn’t get your location. Search by name instead.</div>
        )}
        {/* Nearby results take over when located and the box is empty. */}
        {near && !q && near.map((s) => (
          <button key={s.crs} className="search-item" onClick={() => onPick(s)}>
            <span className="search-name">{s.name}</span>
            <span className="search-near">{fmtKm(s.km)}</span>
            <span className="search-crs">{s.crs}</span>
          </button>
        ))}
        {!(near && !q) && (
          <>
            {stations && results.length === 0 && (
              <div className="muted pad">No stations match “{q}”.</div>
            )}
            {results.map((s) => (
              <button key={s.crs} className="search-item" onClick={() => onPick(s)}>
                <span className="search-name">{s.name}</span>
                <span className="search-crs">{s.crs}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
