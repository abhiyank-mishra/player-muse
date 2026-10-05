import { Song } from './types';

export interface HomeFeedData {
  communityTrending: Song[];
  madeForYou: Song[];
  madeForYouPersonalized: boolean;
  globalExplorer: Song[];
  allDiscoverSongs: Song[];
  timestamp: number;
}

// In-memory module singleton.
// Lives in JavaScript memory as long as the tab is open.
// Survives all client-side navigations (Home -> Playlist -> Back).
// On page refresh (F5), this starts null on both server and client to avoid SSR hydration mismatches.
let inMemoryHomeCache: HomeFeedData | null = null;
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes

export const homeCache = {
  // Synchronous getter for in-memory cache (safe for SSR and client navigation)
  get: (): HomeFeedData | null => {
    if (inMemoryHomeCache && Date.now() - inMemoryHomeCache.timestamp < CACHE_TTL_MS) {
      return inMemoryHomeCache;
    }
    return null;
  },

  // Called in useEffect (after hydration is complete) to restore from sessionStorage
  restoreFromStorage: (): HomeFeedData | null => {
    if (inMemoryHomeCache && Date.now() - inMemoryHomeCache.timestamp < CACHE_TTL_MS) {
      return inMemoryHomeCache;
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('muse_home_feed_v2');
        if (raw) {
          const parsed: HomeFeedData = JSON.parse(raw);
          if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
            inMemoryHomeCache = parsed;
            return parsed;
          }
        }
      } catch (e) {}
    }
    return null;
  },

  set: (partial: Partial<HomeFeedData>) => {
    const current = homeCache.get() || {
      communityTrending: [],
      madeForYou: [],
      madeForYouPersonalized: false,
      globalExplorer: [],
      allDiscoverSongs: [],
      timestamp: Date.now(),
    };

    inMemoryHomeCache = {
      ...current,
      ...partial,
      timestamp: Date.now(),
    };

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('muse_home_feed_v2', JSON.stringify(inMemoryHomeCache));
      } catch (e) {}
    }
  },

  hasValidData: (): boolean => {
    const data = homeCache.get();
    return !!(data && (data.communityTrending.length > 0 || data.madeForYou.length > 0));
  }
};
