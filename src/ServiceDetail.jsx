import { Fragment, useEffect, useState } from 'react'
import { getService } from './api.js'
import { isPinned, setPinned, clearPinned } from './storage.js'

const isTime = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)

// Turn a HH:MM scheduled time into an absolute expiry (ms). Darwin gives only
// wall-clock times with no date, so we pin it to today; if that lands more than
// an hour in the past, the service runs after midnight (or the board is for a
// late-night train) so roll to tomorrow. A 90-min grace covers delays.
function expiryFor(hhmm) {
  if (!isTime(hhmm)) return null
  const now = new Date()
  const [h, m] = hhmm.split(':').map(Number)
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  if (at.getTime() < now.getTime() - 60 * 60 * 1000) at.setDate(at.getDate() + 1)
  return at.getTime() + 90 * 60 * 1000
}

// Status line for a stop. Passed stops report their actual time/value (muted);
// upcoming stops show the estimate (on-time green / revised time red).
function stopStatus({ at, et, sched, passed }) {
  if (passed) {
    if (isTime(at)) return { text: `at ${at}`, cls: 'passed' }      // called at a revised time
    if (at === 'On time') return { text: 'on time', cls: 'passed' }
    return { text: at, cls: at === 'Cancelled' ? 'delay' : 'passed' }
  }
  const v = et || at
  if (!v) return { text: '', cls: '' }
  if (v === 'On time') return { text: 'On time', cls: 'on-time' }
  if (v === 'Cancelled' || v === 'Delayed') return { text: v, cls: 'delay' }
  return { text: v === sched ? '' : v, cls: 'delay' } // bare HH:MM = revised time -> late
}

function Stop({ stop }) {
  const st = stopStatus(stop)
  return (
    <div className={`stop ${stop.here ? 'stop-here' : ''} ${stop.passed ? 'stop-passed' : ''}`}>
      <div className="stop-marker"><span className="stop-dot" /></div>
      <div className="stop-time">{stop.sched}</div>
      <div className="stop-body">
        <div className="stop-name">
          {stop.name}
          {stop.platform ? <span className="stop-plat"> · Plat {stop.platform}</span> : null}
        </div>
        {st.text && st.text !== stop.sched && <div className={`stop-status ${st.cls}`}>{st.text}</div>}
      </div>
    </div>
  )
}

// Normalise a Darwin calling point into our flat stop shape.
const toStop = (p) => ({ name: p.locationName, sched: p.st, at: p.at, et: p.et, crs: p.crs })

export default function ServiceDetail({ serviceId, summary, onClose }) {
  const [svc, setSvc] = useState(null)
  const [error, setError] = useState(null)
  const [pinned, setPinnedState] = useState(() => isPinned(serviceId))

  useEffect(() => {
    let live = true
    setSvc(null); setError(null)
    getService(serviceId)
      .then((d) => live && setSvc(d))
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [serviceId])

  // Full journey: where it's been (previous) -> this station -> where it's going.
  const prev = (svc?.previousCallingPoints?.[0]?.callingPoint ?? []).map(toStop)
  const subsequent = (svc?.subsequentCallingPoints?.[0]?.callingPoint ?? []).map(toStop)
  const here = svc && {
    name: svc.locationName,
    sched: svc.std || svc.sta,
    at: svc.atd || svc.ata,
    et: svc.etd || svc.eta,
    platform: svc.platform,
    crs: svc.crs,
    here: true,
  }
  const stops = svc ? [...prev, here, ...subsequent] : []
  // Any non-null actual value (`at`) means the train has called there — that's
  // the signal previous calling points carry; upcoming stops have only `et`.
  stops.forEach((s) => { s.passed = s.at != null && s.at !== '' })
  let lastPassed = -1
  stops.forEach((s, i) => { if (s.passed) lastPassed = i })

  const dest = subsequent.length ? subsequent[subsequent.length - 1].name : summary?.dest

  function togglePin() {
    if (pinned) {
      clearPinned()
      setPinnedState(false)
      return
    }
    // Expire when the train should have reached its destination (or this stop,
    // if no onward calling points are listed).
    const arr = subsequent.length ? subsequent[subsequent.length - 1].sched : here?.sched
    const label = `${here?.sched ?? ''} ${svc.locationName}${dest ? ` to ${dest}` : ''}`.trim()
    setPinned({ serviceId, label, expiresAt: expiryFor(arr) })
    setPinnedState(true)
  }

  return (
    <div className="overlay">
      <header className="hdr">
        <button className="hdr-back" onClick={onClose} aria-label="Back to board">&#8592;</button>
        <h1>{summary?.std} {dest ? `to ${dest}` : 'Service'}</h1>
      </header>

      <div className="wrap">
        {error && <div className="error">Couldn’t load service: {error}</div>}
        {!svc && !error && <div className="muted pad">Loading service…</div>}

        {svc && (
          <>
            <div className="detail-meta">
              <span>{svc.operator}</span>
              {svc.platform && <span>Platform {svc.platform}</span>}
              {svc.length ? <span>{svc.length} coaches</span> : null}
            </div>

            <button
              className={`pin-btn ${pinned ? 'pin-on' : ''}`}
              onClick={togglePin}
              aria-pressed={pinned}
            >
              <span className="pin-icon">{pinned ? '★' : '☆'}</span>
              {pinned ? 'Unpin this train' : 'Pin this train'}
            </button>

            {svc.isCancelled && (
              <div className="alert">
                <p><strong>Cancelled.</strong> {svc.cancelReason}</p>
              </div>
            )}
            {!svc.isCancelled && svc.delayReason && (
              <div className="alert">
                <p>{svc.delayReason}</p>
              </div>
            )}

            <h2 className="detail-h">Route</h2>
            <div className="card timeline">
              {stops.map((s, i) => (
                <Fragment key={`${s.crs}-${i}`}>
                  <Stop stop={s} />
                  {i === lastPassed && i < stops.length - 1 && (
                    <div className="train-pos" title={`Train en route to ${stops[i + 1].name}`}>
                      <span className="train-pos-dot" />
                    </div>
                  )}
                </Fragment>
              ))}
              {stops.length <= 1 && (
                <div className="muted pad">No calling points listed.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
