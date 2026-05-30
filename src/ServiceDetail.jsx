import { Fragment, useEffect, useState } from 'react'
import { getService } from './api.js'
import { isPinned, setPinned, clearPinned } from './storage.js'
import { loadingLevel, avgLoading, hasCoachLoading, hasToilet } from './formation.js'

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
        {stop.detachFront && (
          <div className="stop-split">Train splits here — front coaches detach</div>
        )}
      </div>
    </div>
  )
}

// Train formation: a row of carriages, shaded by live crowding where reported,
// First-class coaches highlighted. Falls back to a service-wide "how busy" line
// when only an average is given, and renders nothing when no formation exists.
function Formation({ formation }) {
  const coaches = formation?.coaches ?? []
  if (!coaches.length) {
    const avg = avgLoading(formation)
    if (avg == null) return null
    const lvl = loadingLevel(avg)
    return (
      <>
        <h2 className="detail-h">How busy</h2>
        <div className={`load-summary ${lvl.cls}`}>
          Usually <strong>{lvl.label.toLowerCase()}</strong> — about {avg}% full
        </div>
      </>
    )
  }
  const showLoading = hasCoachLoading(formation)
  return (
    <>
      <h2 className="detail-h">Train formation</h2>
      <div className="formation" role="img" aria-label={`${coaches.length} coaches`}>
        {coaches.map((c, i) => {
          const lvl = c.loadingSpecified ? loadingLevel(c.loading) : null
          return (
            <div
              key={i}
              className={`coach ${c.coachClass === 'First' ? 'coach-first' : ''}`}
              title={lvl ? `Coach ${c.number}: ${lvl.label} (${c.loading}% full)` : `Coach ${c.number}`}
            >
              {lvl && <div className={`coach-fill ${lvl.cls}`} style={{ height: `${Math.max(c.loading, 8)}%` }} />}
              <span className="coach-num">{c.number}</span>
              {hasToilet(c.toilet) && <span className="coach-toilet" aria-label="toilet">wc</span>}
            </div>
          )
        })}
      </div>
      {showLoading && (
        <div className="load-legend">
          <span className="load-low">Quiet</span>
          <span className="load-mid">Moderate</span>
          <span className="load-high">Busy</span>
        </div>
      )}
      {coaches.some((c) => c.coachClass === 'First') && (
        <div className="muted formation-note">Highlighted coaches are First class.</div>
      )}
    </>
  )
}

// Normalise a Darwin calling point into our flat stop shape. `detachFront` flags
// a stop where the front portion of the train splits off.
const toStop = (p) => ({
  name: p.locationName,
  sched: p.st,
  at: p.at,
  et: p.et,
  crs: p.crs,
  detachFront: p.detachFront,
})

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
    detachFront: svc.detachFront,
    here: true,
  }
  const stops = svc ? [...prev, here, ...subsequent] : []
  // Any non-null actual value (`at`) means the train has called there — that's
  // the signal previous calling points carry; upcoming stops have only `et`.
  stops.forEach((s) => { s.passed = s.at != null && s.at !== '' })
  let lastPassed = -1
  stops.forEach((s, i) => { if (s.passed) lastPassed = i })

  const dest = subsequent.length ? subsequent[subsequent.length - 1].name : summary?.dest

  // Portion working / reversal: any stop where the front detaches means the
  // train splits; isReverseFormation means coach order is back-to-front.
  const splits = !!(svc?.detachFront || stops.some((s) => s.detachFront))
  const reversed = !!svc?.isReverseFormation
  // Diversion: Darwin exposes the *current* (live) origin/destination separately
  // from the booked ones when a service has been diverted or curtailed.
  const divertedTo = svc?.currentDestinations?.[0]?.locationName
  const diverted = divertedTo && divertedTo !== dest

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
            {diverted && (
              <div className="alert">
                <p><strong>Diverted.</strong> Now terminating at {divertedTo} (booked to {dest}).</p>
              </div>
            )}
            {(splits || reversed) && (
              <div className="notice">
                {splits && <p>This train splits en route — check platform displays for which coaches to board.</p>}
                {reversed && <p>Coaches are in reverse order at this station.</p>}
              </div>
            )}

            <Formation formation={svc.formation} />

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
