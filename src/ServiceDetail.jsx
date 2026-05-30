import { Fragment, useEffect, useState } from 'react'
import { getService } from './api.js'

const isTime = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)

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
