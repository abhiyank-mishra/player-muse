export interface CachedUserPlaylist {
  id: string;
  name: string;
  songs: any[];
  is_active?: boolean;
  createdAt?: any;
  coverImage?: string;
}

// In-memory module singleton for client navigation
let memoryPlaylistsCache: CachedUserPlaylist[] | null = null;
let lastUserId: string | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

export const userPlaylistsCache = {
  // Synchronous in-memory get (safe for SSR and client navigation)
  get: (userId?: string | null): CachedUserPlaylist[] | null => {
    if (!userId) return null;
    if (
      memoryPlaylistsCache &&
      lastUserId === userId &&
      Date.now() - lastCacheTime < CACHE_TTL_MS
    ) {
      return memoryPlaylistsCache;
    }
    return null;
  },

  // Called in useEffect (after hydration is complete) to restore from sessionStorage
  restoreFromStorage: (userId?: string | null): CachedUserPlaylist[] | null => {
    if (!userId) return null;
    if (memoryPlaylistsCache && lastUserId === userId && Date.now() - lastCacheTime < CACHE_TTL_MS) {
      return memoryPlaylistsCache;
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(`user_pl_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && Date.now() - lastCacheTime < CACHE_TTL_MS) {
            memoryPlaylistsCache = parsed;
            lastUserId = userId;
            lastCacheTime = Date.now();
            return parsed;
          }
        }
      } catch (e) {}
    }
    return null;
  },

  getOne: (userId: string | null | undefined, playlistId: string): CachedUserPlaylist | null => {
    const list = userPlaylistsCache.get(userId) || userPlaylistsCache.restoreFromStorage(userId);
    if (!list) return null;
    return list.find((p) => p.id === playlistId) || null;
  },

  set: (userId: string, playlists: CachedUserPlaylist[]) => {
    if (!userId || !Array.isArray(playlists)) return;
    memoryPlaylistsCache = playlists;
    lastUserId = userId;
    lastCacheTime = Date.now();

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`user_pl_${userId}`, JSON.stringify(playlists));
      } catch (e) {}
    }
  },

  updateSingle: (userId: string, playlistId: string, updated: Partial<CachedUserPlaylist>) => {
    const list = userPlaylistsCache.get(userId) || userPlaylistsCache.restoreFromStorage(userId);
    if (!list) return;
    const next = list.map((p) => (p.id === playlistId ? { ...p, ...updated } : p));
    userPlaylistsCache.set(userId, next);
  },

  invalidate: (userId?: string) => {
    memoryPlaylistsCache = null;
    lastCacheTime = 0;
    if (typeof window !== 'undefined' && userId) {
      try {
        sessionStorage.removeItem(`user_pl_${userId}`);
      } catch (e) {}
    }
  }
};
