/** How often open screens ask the server whether anything changed. */
export const LIVE_UPDATE_INTERVAL = 10_000;
/** Full reload now and then, in case a change ever slips past the change counters. */
export const SAFETY_REFRESH_INTERVAL = 5 * 60_000;

/**
 * Areas whose counter moved between two readings of /api/changes.
 * The first reading changes nothing, and a data change already reloads the cases.
 */
export function changedAreas(before, after) {
  if (!before || !after) return [];
  const moved = Object.keys(after).filter((area) => after[area] !== before[area]);
  return moved.includes("data") ? moved.filter((area) => area !== "cases") : moved;
}
