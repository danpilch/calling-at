import { getFavourites, getRecents } from './storage.js'

// "My Travel" tab: saved favourite stations and recently-viewed ones.
// Tapping a station opens its live board (handled by the parent).
function StationList({ items, onPick }) {
  return (
    <div className="card">
      {items.map((s) => (
        <button key={s.crs} className="search-item" onClick={() => onPick(s)}>
          <span className="search-name">{s.name}</span>
          <span className="search-crs">{s.crs}</span>
        </button>
      ))}
    </div>
  )
}

export default function MyTravel({ onPick, onFindStation }) {
  const favourites = getFavourites()
  const recents = getRecents()

  return (
    <main className="wrap">
      <h2>My Travel</h2>

      <h3 className="section-h">Favourites</h3>
      {favourites.length === 0 ? (
        <p className="muted pad">
          No favourites yet. Open a station board and tap the star to save it here.
        </p>
      ) : (
        <StationList items={favourites} onPick={onPick} />
      )}

      <h3 className="section-h">Recent</h3>
      {recents.length === 0 ? (
        <p className="muted pad">Stations you view will appear here.</p>
      ) : (
        <StationList items={recents} onPick={onPick} />
      )}

      <button className="search-trigger find-station" onClick={onFindStation}>
        <span className="search-icon">&#9906;</span>
        <span>Find a station</span>
        <span className="search-trigger-hint">Search all 2,900+</span>
      </button>
    </main>
  )
}
