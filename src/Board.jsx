import { useEffect, useState, useCallback } from 'react'
import { getBoard, getJourneys } from './api.js'
import StationSearch from './StationSearch.jsx'
import PinnedTrain from './PinnedTrain.jsx'
import { navigate, replace } from './router.js'
import { isFavourite, toggleFavourite, addRecent } from './storage.js'
import { loadingLevel, avgLoading, hasCoachLoading } from './formation.js'

const QUICK = ['WIN', 'PAD', 'KGX', 'EUS', 'WAT', 'VIC']
const REFRESH_MS = 30000

function statusClass(etd) {
  if (!etd) return ''
  if (etd === 'On time') return 'on-time'
  return 'delay'
}

// Darwin stamps `generatedAt` as a full ISO instant in UTC (e.g. ...T11:48+00:00).
// Format it in the browser's own timezone so the "as of" time lines up with the
// UK-local HH:MM train times (in BST that's UTC+1, so 11:48Z → 12:48).
function localTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Board-level crowding %: prefer Darwin's service average, else the mean of the
// per-coach loadings when those are reported. Null when no loading data at all.
function boardLoading(formation) {
  const avg = avgLoading(formation)
  if (avg != null) return avg
  if (!hasCoachLoading(formation)) return null
  const ls = formation.coaches.filter((c) => c.loadingSpecified).map((c) => c.loading)
  return Math.round(ls.reduce((a, b) => a + b, 0) / ls.length)
}

function CrowdBadge({ formation }) {
  const pct = boardLoading(formation)
  const lvl = loadingLevel(pct)
  if (!lvl) return null
  return <span className={`crowd ${lvl.cls}`} title={`About ${pct}% full`}>● {lvl.label}</span>
}

function ServiceRow({ s, mode, onOpen }) {
  const arrivals = mode === 'arrivals'
  // Use the live (current) origin/destination when a service has been diverted.
  const current = arrivals ? s.currentOrigins?.[0] : s.currentDestinations?.[0]
  const place = current ?? (arrivals ? s.origin : s.destination)?.[0]
  const name = place?.locationName ?? '—'
  const via = place?.via ? ` ${place.via}` : ''
  const sched = arrivals ? s.sta : s.std
  const expected = s.isCancelled ? 'Cancelled' : (arrivals ? s.eta : s.etd)
  return (
    <button className="svc" onClick={() => onOpen(s, name, sched)}>
      <div className="svc-time">{sched}</div>
      <div className="svc-dest">
        <div className="svc-dest-name">
          {arrivals ? 'from ' : ''}{name}{via}
          {current && <span className="svc-tag">diverted</span>}
        </div>
        <div className="svc-meta">
          {s.operator}{s.platform ? ` · Plat ${s.platform}` : ' · Plat —'}
          <CrowdBadge formation={s.formation} />
        </div>
      </div>
      <div className={`svc-status ${statusClass(expected)}`}>{expected}</div>
      <span className="svc-chevron">&#8250;</span>
    </button>
  )
}

// Rail-replacement bus / ferry services (board-level busServices / ferryServices).
// Same shape as trains but with no live tracking, so these rows aren't tappable.
function ReplacementRow({ s, mode, type }) {
  const arrivals = mode === 'arrivals'
  const place = (arrivals ? s.origin : s.destination)?.[0]
  const name = place?.locationName ?? '—'
  const sched = arrivals ? s.sta : s.std
  const expected = s.isCancelled ? 'Cancelled' : (arrivals ? s.eta : s.etd)
  return (
    <div className="svc svc-alt">
      <div className="svc-time">{sched}</div>
      <div className="svc-dest">
        <div className="svc-dest-name">
          <span className="svc-tag svc-tag-alt">{type === 'ferry' ? '⛴ Ferry' : '🚌 Bus'}</span>
          {arrivals ? 'from ' : ''}{name}
        </div>
        <div className="svc-meta">
          {s.operator || `Replacement ${type}`}
        </div>
      </div>
      <div className={`svc-status ${statusClass(expected)}`}>{expected}</div>
    </div>
  )
}

// Live departure/arrival board for a station. crs/mode/filterCrs come from the
// URL; this owns data loading, auto-refresh, the favourite star, and the
// station / "calling at" pickers.
export default function Board({ crs, mode, filterCrs, onOpenService }) {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fav, setFav] = useState(false)
  const [picker, setPicker] = useState(null) // 'station' | 'filter' | null

  // Filtering ("calling at") only applies to departures.
  const filter = mode === 'departures' ? filterCrs : null

  const load = useCallback(async (isRefresh = false) => {
    setLoading(true)
    if (!isRefresh) setError(null)
    try {
      const b = filter
        ? await getJourneys(crs, filter, 12)
        : await getBoard(mode, crs, 12)
      setBoard(b)
      setError(null)
      if (b.locationName) addRecent({ crs, name: b.locationName })
    } catch (e) {
      setError(e.message)
      if (!isRefresh) setBoard(null)
    } finally {
      setLoading(false)
    }
  }, [crs, mode, filter])

  useEffect(() => { setBoard(null); load() }, [load])
  useEffect(() => { setFav(isFavourite(crs)) }, [crs])

  // Auto-refresh, paused while the picker overlay is open.
  useEffect(() => {
    if (picker) return
    const id = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [load, picker])

  // Close the picker on browser Back.
  useEffect(() => {
    const onPop = () => setPicker(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function openPicker(kind) {
    window.history.pushState({ overlay: 'picker' }, '')
    setPicker(kind)
  }

  function toggleFav() {
    if (!board?.locationName) return
    toggleFavourite({ crs, name: board.locationName })
    setFav((f) => !f)
  }

  if (picker) {
    return (
      <StationSearch
        onClose={() => window.history.back()}
        onPick={(st) => {
          // replaceState consumes the picker's history entry, so Back returns
          // to the previous board rather than re-opening the picker.
          if (picker === 'filter') replace(`/live/${crs}/${mode}/to/${st.crs}`)
          else replace(`/live/${st.crs}/${mode}`)
          setPicker(null)
        }}
      />
    )
  }

  const services = board?.trainServices ?? []
  const buses = board?.busServices ?? []
  const ferries = board?.ferryServices ?? []
  const messages = board?.nrccMessages ?? []

  return (
    <main className="wrap">
      <h2>{mode === 'arrivals' ? 'Live Arrivals' : 'Live Departures'}</h2>

      <PinnedTrain />

      <div className="station-bar">
        <button className="search-trigger" onClick={() => openPicker('station')}>
          <span className="search-icon">&#9906;</span>
          <span>{board?.locationName ?? crs}</span>
          <span className="search-trigger-hint">Change station</span>
        </button>
        <button
          className={`fav-btn ${fav ? 'fav-on' : ''}`}
          onClick={toggleFav}
          disabled={!board?.locationName}
          aria-pressed={fav}
          aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
        >{fav ? '★' : '☆'}</button>
      </div>

      <div className="chips">
        {QUICK.map((c) => (
          <button
            key={c}
            className={`chip ${c === crs ? 'chip-on' : ''}`}
            onClick={() => navigate(`/live/${c}/${mode}`)}
          >{c}</button>
        ))}
      </div>

      <div className="toggle" role="tablist">
        <button
          role="tab"
          className={mode === 'departures' ? 'toggle-on' : ''}
          onClick={() => navigate(`/live/${crs}/departures${filter ? `/to/${filter}` : ''}`)}
        >Departures</button>
        <button
          role="tab"
          className={mode === 'arrivals' ? 'toggle-on' : ''}
          onClick={() => navigate(`/live/${crs}/arrivals`)}
        >Arrivals</button>
      </div>

      {mode === 'departures' && (
        <div className="calling-at">
          {filter ? (
            <span className="calling-at-on">
              Calling at <strong>{board?.filterLocationName ?? filter}</strong>
              <button className="calling-at-clear" onClick={() => navigate(`/live/${crs}/departures`)} aria-label="Clear filter">✕</button>
            </span>
          ) : (
            <button className="calling-at-add" onClick={() => openPicker('filter')}>
              + Only trains calling at…
            </button>
          )}
        </div>
      )}

      {board && (
        <div className="board-head">
          <strong>{board.locationName}</strong>
          <span className="muted">
            {loading ? 'Updating…' : `as of ${localTime(board.generatedAt)}`}
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

      {board && services.length === 0 && buses.length === 0 && ferries.length === 0 && !loading && (
        <div className="muted pad">
          No {mode} listed right now{filter ? ` calling at ${board?.filterLocationName ?? filter}` : ''}.
        </div>
      )}

      <div className="card">
        {services.map((s) => (
          <ServiceRow key={s.serviceIdGuid ?? s.serviceIdUrlSafe} s={s} mode={mode} onOpen={onOpenService} />
        ))}
        {buses.map((s, i) => (
          <ReplacementRow key={`bus-${i}`} s={s} mode={mode} type="bus" />
        ))}
        {ferries.map((s, i) => (
          <ReplacementRow key={`ferry-${i}`} s={s} mode={mode} type="ferry" />
        ))}
      </div>
    </main>
  )
}
