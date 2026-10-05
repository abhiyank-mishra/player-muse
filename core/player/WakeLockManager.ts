/**
 * WakeLockManager — Uses the Screen Wake Lock API to prevent the device from
 * going to sleep and potentially killing the browser tab/page while music is
 * playing.  The API is supported on modern Chrome (Android), Edge, and Safari.
 *
 * On browsers that don't support it, this module is a harmless no-op.
 *
 * The wake lock is automatically re-acquired when the page becomes visible
 * again (e.g. the user unlocks their phone) because browsers release
 * wake locks when the page is hidden.
 */
let wakeLock: WakeLockSentinel | null = null;
let isHolding = false;

async function acquireWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
      // If we still want to hold the lock (music is still playing), re-acquire
      // on visibility change below.
    });
    console.log('[WakeLock] Acquired');
  } catch (err) {
    // This can fail if the page is hidden — that's fine; we'll retry on
    // visibilitychange.
    console.log('[WakeLock] Could not acquire:', err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
    console.log('[WakeLock] Released');
  }
}

/**
 * Re-acquire the wake lock when the document becomes visible again.
 * Browsers automatically release wake locks when a page goes hidden;
 * this ensures we get it back as soon as the user returns.
 */
function onVisibilityChange() {
  if (isHolding && document.visibilityState === 'visible') {
    acquireWakeLock();
  }
}

/**
 * Call this when playback STARTS. Sets up the wake lock and the
 * re-acquisition listener.
 */
export function requestWakeLock() {
  if (typeof document === 'undefined') return;
  isHolding = true;
  acquireWakeLock();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

/**
 * Call this when playback STOPS (paused or ended with nothing in queue).
 * Releases the wake lock and removes the listener.
 */
export function releasePlayerWakeLock() {
  isHolding = false;
  releaseWakeLock();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
}
