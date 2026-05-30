import { useEffect } from 'react'
import Board from './Board.jsx'
import StationSearch from './StationSearch.jsx'
import ServiceDetail from './ServiceDetail.jsx'
import MyTravel from './MyTravel.jsx'
import Journeys from './Journeys.jsx'
import More from './More.jsx'
import { useRoute, segments, navigate, replace } from './router.js'

const DEFAULT = '/live/WIN/departures'

const TABS = [
  { key: 'mytravel', label: 'My Travel' },
  { key: 'live', label: 'Live Trains' },
  { key: 'journeys', label: 'Journeys' },
  { key: 'stations', label: 'Stations' },
  { key: 'more', label: 'More' },
]

// Which bottom tab is highlighted for a given route view.
function tabFor(view) {
  if (view === 'search') return 'stations'
  if (view === 'service') return 'live'
  return view
}

export default function App() {
  const hash = useRoute()
  const seg = segments(hash)
  const view = seg[0] || 'live'

  // Normalise the root to the default board.
  useEffect(() => {
    if (seg.length === 0) replace(DEFAULT)
  }, [seg.length])

  function openService(s) {
    const id = s.serviceIdUrlSafe ?? s.serviceIdPercentEncoded
    if (id) navigate(`/service/${encodeURIComponent(id)}`)
  }

  let main_view
  if (view === 'service') {
    main_view = <ServiceDetail serviceId={seg[1]} onClose={() => window.history.back()} />
  } else if (view === 'search') {
    // Standalone search (Stations tab / "Find a station") — pick replaces this
    // transient entry with the chosen board so Back skips the search.
    main_view = (
      <StationSearch
        onClose={() => window.history.back()}
        onPick={(st) => replace(`/live/${st.crs}/departures`)}
      />
    )
  } else if (view === 'journeys') {
    main_view = (
      <Journeys
        fromCrs={seg[1]}
        toCrs={seg[2]}
        onPair={(f, t) => replace(`/journeys/${f}/${t}`)}
        onOpenService={openService}
      />
    )
  } else if (view === 'mytravel') {
    main_view = (
      <MyTravel
        onPick={(st) => navigate(`/live/${st.crs}/departures`)}
        onFindStation={() => navigate('/search')}
      />
    )
  } else if (view === 'more') {
    main_view = <More />
  } else {
    // 'live' — /live/:crs/:mode[/to/:filter]
    const crs = seg[1] || 'WIN'
    const mode = seg[2] === 'arrivals' ? 'arrivals' : 'departures'
    const filterCrs = seg[3] === 'to' ? seg[4] : null
    main_view = <Board crs={crs} mode={mode} filterCrs={filterCrs} onOpenService={openService} />
  }

  const activeTab = tabFor(view)

  function onTab(key) {
    if (key === 'live') navigate(DEFAULT)
    else if (key === 'stations') navigate('/search')
    else navigate(`/${key}`)
  }

  return (
    <div className="app">
      <header className="hdr">
        <span className="hdr-arrow">&#8594;</span>
        <h1>Calling<span className="hdr-accent"> At</span></h1>
      </header>

      {main_view}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={t.key === activeTab ? 'tab-on' : ''}
            onClick={() => onTab(t.key)}
          >{t.label}</button>
        ))}
      </nav>
    </div>
  )
}
