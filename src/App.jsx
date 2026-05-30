import { useEffect, useState, useCallback } from 'react'
import { getBoard } from './api.js'
import StationSearch from './StationSearch.jsx'
import ServiceDetail from './ServiceDetail.jsx'

// A handful of well-known stations for quick selection. Full search lives in StationSearch.
const QUICK = [
  { crs: 'WIN', name: 'Winchester' },
  { crs: 'PAD', name: 'London Paddington' },
  { crs: 'KGX', name: 'London Kings Cross' },
  { crs: 'EUS', name: 'London Euston' },
  { crs: 'WAT', name: 'London Waterloo' },
  { crs: 'VIC', name: 'London Victoria' },
  { crs: 'LDS', name: 'Leeds' },
  { crs: 'MAN', name: 'Manchester Piccadilly' },
  { crs: 'BHM', name: 'Birmingham New Street' },
  { crs: 'EDB', name: 'Edinburgh' },
  { crs: 'BRI', name: 'Bristol Temple Meads' },
]

function statusClass(etd) {
  if (!etd) return ''
  if (etd === 'On time') return 'on-time'
  if (etd === 'Cancelled' || etd === 'Delayed') return 'delay'
  return 'delay' // an "Exp HH:MM" expected time means it's running late
}

function ServiceRow({ s, mode, onOpen }) {
  // Departures key off destination + std/etd; arrivals off origin + sta/eta.
  const arrivals = mode === 'arrivals'
  const place = (arrivals ? s.origin : s.destination)?.[0]
  const name = place?.locationName ?? '—'
  const via = place?.via ? ` ${place.via}` : ''
  const sched = arrivals ? s.sta : s.std
  const expected = s.isCancelled ? 'Cancelled' : (arrivals ? s.eta : s.etd)
  return (
    <button className="svc" onClick={() => onOpen(s, name, sched)}>
      <div className="svc-time">{sched}</div>
      <div className="svc-dest">
        <div className="svc-dest-name">{arrivals ? 'from ' : ''}{name}{via}</div>
        <div className="svc-meta">
          {s.operator}{s.platform ? ` · Plat ${s.platform}` : ' · Plat —'}
        </div>
      </div>
      <div className={`svc-status ${statusClass(expected)}`}>{expected}</div>
      <span className="svc-chevron">&#8250;</span>
    </button>
  )
}

const REFRESH_MS = 30000

export default function App() {
  const [crs, setCrs] = useState('WIN')
  const [mode, setMode] = useState('departures') // 'departures' | 'arrivals'
  const [board, setBoard] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selected, setSelected] = useState(null) // { id, std, dest }

  // Refreshes keep the current board on screen on error (don't flash empty);
  // only an initial/changed load clears it.
  const load = useCallback(async (code, m, isRefresh = false) => {
    setLoading(true)
    if (!isRefresh) setError(null)
    try {
      setBoard(await getBoard(m, code, 12))
      setError(null)
    } catch (e) {
      setError(e.message)
      if (!isRefresh) setBoard(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const overlayOpen = searchOpen || selected !== null

  useEffect(() => {
    setBoard(null)
    load(crs, mode)
  }, [crs, mode, load])

  // Auto-refresh the board; paused while an overlay is open.
  useEffect(() => {
    if (overlayOpen) return
    const id = setInterval(() => load(crs, mode, true), REFRESH_MS)
    return () => clearInterval(id)
  }, [crs, mode, overlayOpen, load])

  // Each overlay pushes a history entry so the device/browser Back button (and
  // the in-app back arrow, via history.back()) closes it instead of leaving the site.
  useEffect(() => {
    const onPop = () => { setSearchOpen(false); setSelected(null) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const services = board?.trainServices ?? []
  const messages = board?.nrccMessages ?? []

  function openSearch() {
    window.history.pushState({ overlay: 'search' }, '')
    setSearchOpen(true)
  }

  function openService(s, name, sched) {
    const id = s.serviceIdPercentEncoded ?? s.serviceIdUrlSafe
    if (!id) return
    window.history.pushState({ overlay: 'detail' }, '')
    setSelected({ id, std: sched, dest: name })
  }

  if (searchOpen) {
    return (
      <StationSearch
        onClose={() => window.history.back()}
        onPick={(st) => { setCrs(st.crs); window.history.back() }}
      />
    )
  }

  if (selected) {
    return (
      <ServiceDetail
        serviceId={selected.id}
        summary={selected}
        onClose={() => window.history.back()}
      />
    )
  }

  return (
    <div className="app">
      <header className="hdr">
        <span className="hdr-arrow">&#8594;</span>
        <h1>Calling<span className="hdr-accent"> At</span></h1>
      </header>

      <main className="wrap">
        <h2>{mode === 'arrivals' ? 'Live Arrivals' : 'Live Departures'}</h2>

        <button className="search-trigger" onClick={openSearch}>
          <span className="search-icon">&#9906;</span>
          <span>{board?.locationName ?? crs}</span>
          <span className="search-trigger-hint">Change station</span>
        </button>

        <div className="chips">
          {QUICK.slice(0, 6).map((q) => (
            <button
              key={q.crs}
              className={`chip ${q.crs === crs ? 'chip-on' : ''}`}
              onClick={() => setCrs(q.crs)}
            >{q.crs}</button>
          ))}
        </div>

        <div className="toggle" role="tablist">
          <button
            role="tab"
            className={mode === 'departures' ? 'toggle-on' : ''}
            onClick={() => setMode('departures')}
          >Departures</button>
          <button
            role="tab"
            className={mode === 'arrivals' ? 'toggle-on' : ''}
            onClick={() => setMode('arrivals')}
          >Arrivals</button>
        </div>

        {board && (
          <div className="board-head">
            <strong>{board.locationName}</strong>
            <span className="muted">
              {loading ? 'Updating…' : `as of ${board.generatedAt?.slice(11, 16) ?? ''}`}
            </span>
          </div>
        )}

        {messages.length > 0 && (
          <div className="alert">
            {messages.map((m, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: m.value }} />
            ))}
          </div>
        )}

        {error && <div className="error">Couldn’t load {mode}: {error}</div>}
        {loading && !board && <div className="muted pad">Loading live board…</div>}

        {board && services.length === 0 && !loading && (
          <div className="muted pad">No {mode} listed right now.</div>
        )}

        <div className="card">
          {services.map((s) => (
            <ServiceRow key={s.serviceIdGuid ?? s.serviceIdUrlSafe} s={s} mode={mode} onOpen={openService} />
          ))}
        </div>
      </main>

      <nav className="tabbar">
        <div>My Travel</div>
        <div className="tab-on">Live Trains</div>
        <div>Journeys</div>
        <div>Stations</div>
        <div>More</div>
      </nav>
    </div>
  )
}
