import { useState, useEffect, useCallback } from 'react'
import { getJourneys, getStations } from './api.js'
import StationSearch from './StationSearch.jsx'

// Minutes between two "HH:MM" strings, assuming arr is later (handles past-midnight).
function durationMins(dep, arr) {
  const p = (t) => /^\d{2}:\d{2}$/.test(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : null
  const a = p(dep), b = p(arr)
  if (a == null || b == null) return null
  return (b - a + 1440) % 1440
}

function fmtDuration(m) {
  if (m == null) return ''
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

// The scheduled + expected arrival time at the destination, read from the
// service's expanded calling points.
function arrivalAt(service, toCrs) {
  const cp = service.subsequentCallingPoints?.[0]?.callingPoint ?? []
  const stop = cp.find((p) => p.crs === toCrs)
  if (!stop) return null
  return { st: stop.st, et: stop.et, cancelled: stop.isCancelled }
}

function JourneyRow({ service, to, onOpen }) {
  const dep = service.std
  const depLate = service.etd && service.etd !== 'On time'
  const arr = arrivalAt(service, to.crs)
  const arrTime = arr?.et && /^\d{2}:\d{2}$/.test(arr.et) ? arr.et : arr?.st
  const arrLate = arr?.et && arr.et !== 'On time' && /^\d{2}:\d{2}$/.test(arr.et)
  const cancelled = service.isCancelled || arr?.cancelled
  const dur = durationMins(dep, arr?.st)

  return (
    <button className="svc journey-row" onClick={() => onOpen(service, to.name, dep)}>
      <div className="journey-times">
        <span className={depLate ? 'delay' : ''}>{dep}</span>
        <span className="journey-arrow">→</span>
        <span className={arrLate ? 'delay' : ''}>{arrTime ?? '—'}</span>
      </div>
      <div className="svc-dest">
        <div className="svc-meta">
          {service.operator}{service.platform ? ` · Plat ${service.platform}` : ''}
        </div>
        <div className="journey-dur">
          {cancelled ? <span className="delay">Cancelled</span> : fmtDuration(dur)}
          {!cancelled && depLate ? <span className="delay"> · Exp {service.etd}</span> : ''}
        </div>
      </div>
      <span className="svc-chevron">&#8250;</span>
    </button>
  )
}

const stub = (crs) => (crs ? { crs, name: crs } : null)

export default function Journeys({ fromCrs, toCrs, onPair, onOpenService }) {
  const [from, setFrom] = useState(() => stub(fromCrs)) // { crs, name }
  const [to, setTo] = useState(() => stub(toCrs))
  const [picking, setPicking] = useState(null) // 'from' | 'to' | null
  const [board, setBoard] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Resolve real names for CRS-only stations (e.g. from a shared link).
  useEffect(() => {
    getStations().then((all) => {
      const byCrs = new Map(all.map((s) => [s.crs, s.name]))
      setFrom((f) => (f && byCrs.has(f.crs) ? { crs: f.crs, name: byCrs.get(f.crs) } : f))
      setTo((t) => (t && byCrs.has(t.crs) ? { crs: t.crs, name: byCrs.get(t.crs) } : t))
    }).catch(() => {})
  }, [])

  const search = useCallback(async (f, t) => {
    setLoading(true)
    setError(null)
    setBoard(null)
    try {
      setBoard(await getJourneys(f, t, 10))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (from?.crs && to?.crs) search(from.crs, to.crs)
  }, [from?.crs, to?.crs, search])

  // Picker overlay pushes history so Back closes it (mirrors App's overlays).
  useEffect(() => {
    const onPop = () => setPicking(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function openPicker(which) {
    window.history.pushState({ overlay: 'journey-picker' }, '')
    setPicking(which)
  }

  if (picking) {
    return (
      <StationSearch
        onClose={() => window.history.back()}
        onPick={(st) => {
          const nf = picking === 'from' ? st : from
          const nt = picking === 'to' ? st : to
          if (picking === 'from') setFrom(st)
          else setTo(st)
          setPicking(null)
          // If both ends are now set, replace the picker's history entry with the
          // shareable /journeys/from/to URL; otherwise just close the picker.
          if (nf?.crs && nt?.crs) onPair(nf.crs, nt.crs)
          else window.history.back()
        }}
      />
    )
  }

  function swap() {
    setFrom(to)
    setTo(from)
    if (from?.crs && to?.crs) onPair(to.crs, from.crs)
  }

  const services = board?.trainServices ?? []

  return (
    <main className="wrap">
      <h2>Journeys</h2>

      <div className="journey-pickers">
        <button className="search-trigger" onClick={() => openPicker('from')}>
          <span className="journey-label">From</span>
          <span>{from ? from.name : 'Choose station'}</span>
        </button>
        <button className="swap-btn" onClick={swap} disabled={!from && !to} aria-label="Swap stations">
          &#8645;
        </button>
        <button className="search-trigger" onClick={() => openPicker('to')}>
          <span className="journey-label">To</span>
          <span>{to ? to.name : 'Choose station'}</span>
        </button>
      </div>

      <p className="muted journey-note">Direct trains only — no changes.</p>

      {error && <div className="error">Couldn’t load journeys: {error}</div>}
      {loading && <div className="muted pad">Finding trains…</div>}

      {board && !loading && services.length === 0 && (
        <div className="muted pad">No direct trains from {from.name} to {to.name} right now.</div>
      )}

      {services.length > 0 && (
        <div className="card">
          {services.map((s) => (
            <JourneyRow
              key={s.serviceIdGuid ?? s.serviceIdUrlSafe}
              service={s}
              to={to}
              onOpen={onOpenService}
            />
          ))}
        </div>
      )}
    </main>
  )
}
