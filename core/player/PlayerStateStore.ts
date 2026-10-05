import { PlayerState, Song } from '@/lib/types';

const STORAGE_KEY = 'muse_player_state';
const TIMESTAMP_KEY = 'muse_player_state_ts';
const VERSION_KEY = 'muse_player_state_v';
const CURRENT_VERSION = '2'; // Bump this to discard stale persisted sessions
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours — discard stale sessions

export interface PersistedPlayerState {
  currentSong: Song | null;
  queue: Song[];
  manualQueue: Song[];
  currentIndex: number;
  seek: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'one' | 'all';
  history: Song[];
  wasPlaying: boolean; // to auto-resume on restore
}

/**
 * Saves the critical player state to sessionStorage for recovery after
 * page refreshes caused by phone lock/unlock or memory pressure.
 *
 * Uses sessionStorage so it only persists within the same browser tab session 
 * (not across new tabs or hard closes), avoiding stale playback surprises.
 */
export function savePlayerState(state: PlayerState) {
  if (typeof window === 'undefined') return;
  try {
    const persisted: PersistedPlayerState = {
      currentSong: state.currentSong,
      queue: state.queue.slice(0, 50), // cap to avoid storage limits
      manualQueue: (state.manualQueue || []).slice(0, 20),
      currentIndex: state.currentIndex,
      seek: state.seek,
      duration: state.duration,
      volume: state.volume,
      isShuffle: state.isShuffle,
      repeatMode: state.repeatMode,
      history: (state.history || []).slice(0, 10),
      wasPlaying: state.isPlaying,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    sessionStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    sessionStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  } catch (e) {
    // Storage may be full — silently ignore
    console.warn('[PlayerStateStore] Failed to save state:', e);
  }
}

/**
 * Restores persisted player state if available and not stale.
 * Returns null if nothing is stored or the data is too old.
 */
export function loadPlayerState(): PersistedPlayerState | null {
  if (typeof window === 'undefined') return null;
  try {
    // Version check — discard state from older versions (e.g. stale SC URLs)
    const ver = sessionStorage.getItem(VERSION_KEY);
    if (ver !== CURRENT_VERSION) {
      console.log('[PlayerStateStore] Version mismatch — discarding stale state');
      clearPlayerState();
      return null;
    }

    const raw = sessionStorage.getItem(STORAGE_KEY);
    const tsRaw = sessionStorage.getItem(TIMESTAMP_KEY);
    if (!raw || !tsRaw) return null;

    const timestamp = parseInt(tsRaw, 10);
    if (Date.now() - timestamp > MAX_AGE_MS) {
      clearPlayerState();
      return null;
    }

    const persisted: PersistedPlayerState = JSON.parse(raw);
    // Validate minimally
    if (!persisted.currentSong || !persisted.currentSong.id) {
      clearPlayerState();
      return null;
    }

    return persisted;
  } catch (e) {
    console.warn('[PlayerStateStore] Failed to load state:', e);
    clearPlayerState();
    return null;
  }
}

/**
 * Clears persisted player state.
 */
export function clearPlayerState() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TIMESTAMP_KEY);
  } catch (e) {
    // noop
  }
}
