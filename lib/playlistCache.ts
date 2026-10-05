import { Song } from './types';

interface CachedPlaylist {
  info: {
    name: string;
    image?: string;
    description?: string;
    subtitle?: string;
  };
  songs: Song[];
  timestamp: number;
}

const memoryCache = new Map<string, CachedPlaylist>();
const CACHE_EXPIRY_MS = 45 * 60 * 1000; // 45 minutes

export const playlistCache = {
  get: (id: string): CachedPlaylist | null => {
    if (!id) return null;
    
    // 1. Check in-memory cache
    const mem = memoryCache.get(id);
    if (mem && Date.now() - mem.timestamp < CACHE_EXPIRY_MS) {
      return mem;
    }

    // 2. Check sessionStorage if in browser
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(`pl_${id}`);
        if (raw) {
          const parsed: CachedPlaylist = JSON.parse(raw);
          if (Date.now() - parsed.timestamp < CACHE_EXPIRY_MS) {
            memoryCache.set(id, parsed); // sync back to memory
            return parsed;
          }
        }
      } catch (e) {
        // Ignore session storage errors
      }
    }
    return null;
  },

  set: (id: string, data: { songs: Song[]; info: any }) => {
    if (!id) return;
    const entry: CachedPlaylist = {
      info: {
        name: data.info?.name || 'Playlist',
        image: data.info?.image || (data.songs?.[0]?.image ? (Array.isArray(data.songs[0].image) ? data.songs[0].image[2] || data.songs[0].image[0] : data.songs[0].image) : undefined),
        description: data.info?.description || '',
        subtitle: data.info?.subtitle || 'Playlist',
      },
      songs: data.songs || [],
      timestamp: Date.now(),
    };

    memoryCache.set(id, entry);

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`pl_${id}`, JSON.stringify(entry));
      } catch (e) {
        // Storage might be full or private mode
      }
    }
  }
};
