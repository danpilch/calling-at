// Live departure data via a public Huxley2 instance — a CORS-enabled JSON proxy
// for the National Rail Darwin LDBWS SOAP API. No backend of our own.
// Swap this base URL to self-host Huxley2 or point at another instance.
const HUXLEY_BASE = 'https://national-rail-api.davwheat.dev'

// GET /{departures|arrivals}/{CRS}/{rows} -> live board as JSON.
export async function getBoard(mode, crs, rows = 12) {
  const res = await fetch(`${HUXLEY_BASE}/${mode}/${crs}/${rows}`)
  if (!res.ok) throw new Error(`Huxley ${res.status} for ${crs}`)
  return res.json()
}

// GET /departures/{from}/to/{to}/{rows}?expand=true -> direct trains from `from`
// that call at `to`, with calling points expanded so we can read the arrival time
// at the destination. (Huxley has no journey planner, so this is direct-only.)
export async function getJourneys(from, to, rows = 10) {
  const res = await fetch(`${HUXLEY_BASE}/departures/${from}/to/${to}/${rows}?expand=true`)
  if (!res.ok) throw new Error(`Huxley ${res.status} for ${from}→${to}`)
  return res.json()
}

// GET /service/{serviceId} -> full service detail incl. calling points.
export async function getService(serviceId) {
  const res = await fetch(`${HUXLEY_BASE}/service/${serviceId}`)
  if (!res.ok) throw new Error(`Huxley ${res.status} for service ${serviceId}`)
  return res.json()
}

// Lazy-loaded full station list (CRS + name), generated from stations_full.csv.
let _stations
export async function getStations() {
  if (!_stations) {
    _stations = fetch(`${import.meta.env.BASE_URL}stations.json`).then((r) => {
      if (!r.ok) throw new Error('stations.json failed to load')
      return r.json()
    })
  }
  return _stations
}
