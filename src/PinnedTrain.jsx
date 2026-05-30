import { getPinned } from './storage.js'
import { navigate } from './router.js'

// The pinned "track this train" box. Self-contained (reads storage, navigates to
// the service) so it can drop into both the live board and My Travel unchanged.
// Renders nothing when no train is pinned (or the pin has expired).
export default function PinnedTrain() {
  const pinned = getPinned()
  if (!pinned) return null
  return (
    <button
      className="pinned-box"
      onClick={() => navigate(`/service/${encodeURIComponent(pinned.serviceId)}`)}
    >
      <span className="pin-icon">★</span>
      <span className="pinned-label">{pinned.label}</span>
      <span className="pinned-arrow">&#8594;</span>
    </button>
  )
}
