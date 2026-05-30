// Helpers for Darwin's train-formation / loading data (the `formation` object on
// services and calling points). Loading is a 0–100 % "how full" figure that only
// some operators report (Elizabeth line gives per-coach; Southern/Southern-style
// give a service-wide average), so every accessor is guarded.

// Map a loading percentage to a crowding band used for colour + label.
export function loadingLevel(pct) {
  if (pct == null) return null
  if (pct <= 35) return { label: 'Quiet', cls: 'load-low' }
  if (pct <= 70) return { label: 'Moderate', cls: 'load-mid' }
  return { label: 'Busy', cls: 'load-high' }
}

// Service-wide average loading %, or null if Darwin didn't supply one.
export function avgLoading(formation) {
  return formation?.avgLoadingSpecified ? formation.avgLoading : null
}

// True if any coach carries a live loading figure (per-coach crowding available).
export function hasCoachLoading(formation) {
  return (formation?.coaches ?? []).some((c) => c.loadingSpecified)
}

// Darwin's toilet field is either a string or { status, value }; treat anything
// that isn't explicitly absent/unknown as "has a toilet".
export function hasToilet(toilet) {
  if (!toilet) return false
  const v = typeof toilet === 'string' ? toilet : toilet.value || toilet.status
  return !!v && !/none|unknown/i.test(v)
}
