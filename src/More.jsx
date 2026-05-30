import { useState } from 'react'
import { getFavourites, getRecents, clearFavourites, clearRecents } from './storage.js'

// "More" tab: about, data attribution, and local-data management.
export default function More() {
  const [favCount, setFavCount] = useState(getFavourites().length)
  const [recentCount, setRecentCount] = useState(getRecents().length)

  return (
    <main className="wrap">
      <h2>More</h2>

      <h3 className="section-h">About</h3>
      <p className="more-text">
        <strong>Calling At</strong> shows live train departures, arrivals, and direct journeys
        across Great Britain. It runs entirely in your browser — there’s no account and no server
        of ours storing your data.
      </p>

      <h3 className="section-h">Data</h3>
      <p className="more-text">
        Live running information is provided by National Rail Enquiries Darwin, fetched via a public{' '}
        <a href="https://huxley2.azurewebsites.net/" target="_blank" rel="noreferrer">Huxley2</a> proxy.
        Station data is derived from the public National Rail station list.
      </p>

      <h3 className="section-h">Your saved stations</h3>
      <div className="card more-actions">
        <button
          className="more-action"
          disabled={favCount === 0}
          onClick={() => { clearFavourites(); setFavCount(0) }}
        >
          <span>Clear favourites</span>
          <span className="search-crs">{favCount}</span>
        </button>
        <button
          className="more-action"
          disabled={recentCount === 0}
          onClick={() => { clearRecents(); setRecentCount(0) }}
        >
          <span>Clear recent stations</span>
          <span className="search-crs">{recentCount}</span>
        </button>
      </div>

      <p className="muted more-foot">
        Not affiliated with National Rail Enquiries. Built from{' '}
        <a href="https://github.com/danpilch/calling-at" target="_blank" rel="noreferrer">open source</a>.
      </p>
    </main>
  )
}
