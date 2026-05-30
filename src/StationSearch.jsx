import { useEffect, useMemo, useRef, useState } from 'react'
import { getStations } from './api.js'

// Full-screen station search overlay. Filters the ~2,900-station list by
// name or CRS; exact 3-letter CRS matches and name-prefix matches rank first.
export default function StationSearch({ onPick, onClose }) {
  const [stations, setStations] = useState(null)
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    getStations().then(setStations).catch(() => setStations([]))
    inputRef.current?.focus()
  }, [])

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
          onChange={(e) => setQ(e.target.value)}
          placeholder="Station name or CRS code"
          aria-label="Search stations"
        />
      </form>
      <div className="search-list">
        {stations === null && <div className="muted pad">Loading stations…</div>}
        {stations && results.length === 0 && (
          <div className="muted pad">No stations match “{q}”.</div>
        )}
        {results.map((s) => (
          <button key={s.crs} className="search-item" onClick={() => onPick(s)}>
            <span className="search-name">{s.name}</span>
            <span className="search-crs">{s.crs}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
