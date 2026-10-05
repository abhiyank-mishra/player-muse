import { Song } from './types';

const DB_NAME = 'muse-offline';
const DB_VERSION = 2; // Upgraded to support playlists
const SONG_STORE = 'songs';
const PLAYLIST_STORE = 'playlists';
const MAX_SONGS = 100;
const MAX_STORAGE_MB = 500;
const MAX_STORAGE_BYTES = MAX_STORAGE_MB * 1024 * 1024;

export interface DownloadedSong {
  id: string;
  blob: Blob;
  metadata: {
    name: string;
    artist: string;
    image: string | string[];
    duration: number;
    url: string; 
    playlistId?: string; // New field
  };
  downloadedAt: number;
  lastPlayedAt: number;
  size: number;
}

export interface DownloadedPlaylist {
  id: string;
  name: string;
  description?: string;
  image?: string;
  type: 'curated' | 'user';
  songCount: number;
  downloadedAt: number;
}

interface StorageStats {
  count: number;
  totalSize: number;
  songs: Array<{
    id: string;
    name: string;
    artist: string;
    size: number;
    downloadedAt: number;
  }>;
}

/**
 * Initialize IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create Songs Store if not exists
      if (!db.objectStoreNames.contains(SONG_STORE)) {
        const store = db.createObjectStore(SONG_STORE, { keyPath: 'id' });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        store.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
        // New index for playlist lookup
        store.createIndex('metadata.playlistId', 'metadata.playlistId', { unique: false });
      } else {
        // Version 2 upgrade: Add index if missing
        const store = (event.target as IDBOpenDBRequest).transaction?.objectStore(SONG_STORE);
        if (store && !store.indexNames.contains('metadata.playlistId')) {
            store.createIndex('metadata.playlistId', 'metadata.playlistId', { unique: false });
        }
      }

      // Create Playlists Store (New in v2)
      if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
        db.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save Playlist Metadata
 */
export async function savePlaylist(playlist: DownloadedPlaylist): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
    const store = tx.objectStore(PLAYLIST_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(playlist);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineStorage] Save Playlist Error:', error);
  }
}

/**
 * Get All Downloaded Playlists
 */
export async function getDownloadedPlaylists(): Promise<DownloadedPlaylist[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, 'readonly');
    const store = tx.objectStore(PLAYLIST_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineStorage] Get Playlists Error:', error);
    return [];
  }
}

/**
 * Get Songs by Playlist ID
 */
export async function getPlaylistSongs(playlistId: string): Promise<DownloadedSong[]> {
    try {
        const db = await openDB();
        const tx = db.transaction(SONG_STORE, 'readonly');
        const store = tx.objectStore(SONG_STORE);
        const index = store.index('metadata.playlistId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(playlistId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[OfflineStorage] Get Playlist Songs Error:', error);
        return [];
    }
}

/**
 * Download and save a song to IndexedDB
 */
export async function downloadSong(song: Song, userEmail?: string, playlistId?: string): Promise<void> {
  try {
    // Check if already downloaded
    const existing = await getDownloadedSong(song.id);
    if (existing) {
      console.log('[OfflineStorage] Song already downloaded:', song.name);
      // Fire complete event so UI doesn't get stuck in downloading state
      const { DownloadProgressBus } = await import('./downloadProgress');
      DownloadProgressBus.emit(`download:complete:${song.id}`, { songId: song.id });
      return;
    }

    // Import isAdmin to check user type
    const { isAdmin } = await import('./downloadWhitelist');
    const isAdminUser = isAdmin(userEmail);

    // Apply storage limits only for non-admin users
    if (!isAdminUser) {
      const stats = await getStorageStats();
      if (stats.count >= MAX_SONGS || stats.totalSize >= MAX_STORAGE_BYTES) {
        console.log('[OfflineStorage] Storage limit reached, cleaning up...');
        await cleanupOldest(10);
      }
    } else {
      console.log('[OfflineStorage] Admin user - unlimited downloads enabled');
    }

    // Fetch fresh metadata to get the latest audio URL (Song ID se fetch karo URL)
    let freshUrl = song.url;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${origin}/api/music/song/${song.id}`);
      if (res.ok) {
        const freshData = await res.json();
        if (freshData.url) freshUrl = freshData.url;
      }
    } catch (e) {
      console.warn('[OfflineStorage] Failed to fetch fresh audio URL, using original:', e);
    }

    // Download audio file
    console.log('[OfflineStorage] Downloading:', song.name);
    
    // Determine download URL
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let finalUrl = freshUrl;
    
    // If it's an external URL, use the proxy. 
    // If it's internal (like /api/music/soundcloud/stream), use it directly.
    const isInternal = freshUrl.startsWith('/') || freshUrl.startsWith(origin);
    
    if (!isInternal) {
        finalUrl = `${origin}/api/music/proxy?url=${encodeURIComponent(freshUrl)}`;
    } else if (freshUrl.startsWith('/')) {
        // Ensure absolute for consistency if needed, though fetch works with relative in browser
        finalUrl = `${origin}${freshUrl}`;
    }

    // Use XHR-based download with progress tracking
    const { downloadWithProgress, DownloadProgressBus } = await import('./downloadProgress');
    DownloadProgressBus.emit(`download:start:${song.id}`, { songId: song.id });

    let blob: Blob;
    try {
      blob = await downloadWithProgress(finalUrl, song.id);
    } catch (dlErr) {
      DownloadProgressBus.emit(`download:error:${song.id}`, { songId: song.id, error: String(dlErr) });
      throw dlErr;
    }
    const size = blob.size;

    // Save to IndexedDB
    const db = await openDB();
    const tx = db.transaction(SONG_STORE, 'readwrite');
    const store = tx.objectStore(SONG_STORE);

    const downloadedSong: DownloadedSong = {
      id: song.id,
      blob,
      metadata: {
        name: song.name,
        artist: song.artist,
        image: song.image,
        duration: song.duration,
        url: song.url,
        playlistId // Optional link
      },
      downloadedAt: Date.now(),
      lastPlayedAt: Date.now(),
      size,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(downloadedSong);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    DownloadProgressBus.emit(`download:complete:${song.id}`, { songId: song.id });
    console.log('[OfflineStorage] Downloaded successfully:', song.name, `(${(size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error('[OfflineStorage] Download error:', error);
    throw error;
  }
}

/**
 * Get a downloaded song from IndexedDB
 */
export async function getDownloadedSong(songId: string): Promise<DownloadedSong | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(SONG_STORE, 'readonly');
    const store = tx.objectStore(SONG_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(songId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineStorage] Get error:', error);
    return null;
  }
}

/**
 * Check if a song is downloaded
 */
export async function isDownloaded(songId: string): Promise<boolean> {
  const song = await getDownloadedSong(songId);
  return song !== null;
}

/**
 * Get all downloaded songs
 */
export async function getDownloadedSongs(): Promise<DownloadedSong[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(SONG_STORE, 'readonly');
    const store = tx.objectStore(SONG_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineStorage] Get all error:', error);
    return [];
  }
}

/**
 * Delete a downloaded song
 */
export async function deleteSong(songId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(SONG_STORE, 'readwrite');
    const store = tx.objectStore(SONG_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(songId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('[OfflineStorage] Deleted:', songId);
  } catch (error) {
    console.error('[OfflineStorage] Delete error:', error);
    throw error;
  }
}

/**
 * Delete a downloaded playlist and its songs (optional)
 */
export async function deletePlaylist(playlistId: string): Promise<void> {
    try {
        const db = await openDB();
        
        // 1. Get all songs in playlist
        const txRead = db.transaction(SONG_STORE, 'readonly');
        const songStore = txRead.objectStore(SONG_STORE);
        const index = songStore.index('metadata.playlistId');
        
        const songs: DownloadedSong[] = await new Promise((resolve) => {
            const req = index.getAll(playlistId);
            req.onsuccess = () => resolve(req.result || []);
        });

        // 2. Delete Song & Playlist
        const txWrite = db.transaction([SONG_STORE, PLAYLIST_STORE], 'readwrite');
        const sStore = txWrite.objectStore(SONG_STORE);
        const pStore = txWrite.objectStore(PLAYLIST_STORE);

        // Delete playlist entry
        pStore.delete(playlistId);

        // Delete songs
        songs.forEach(song => {
            sStore.delete(song.id);
        });

        console.log('[OfflineStorage] Deleted Playlist:', playlistId);
    } catch (error) {
        console.error('[OfflineStorage] Delete playlist error:', error);
    }
}

/**
 * Rename a downloaded playlist (offline name only)
 */
export async function renamePlaylist(playlistId: string, newName: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
        const store = tx.objectStore(PLAYLIST_STORE);

        const existing: DownloadedPlaylist | undefined = await new Promise((resolve) => {
            const req = store.get(playlistId);
            req.onsuccess = () => resolve(req.result);
        });

        if (existing) {
            existing.name = newName;
            await new Promise<void>((resolve, reject) => {
                const req = store.put(existing);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            console.log('[OfflineStorage] Renamed playlist:', playlistId, '->', newName);
        }
    } catch (error) {
        console.error('[OfflineStorage] Rename playlist error:', error);
    }
}

/**
 * Update last played timestamp
 */
export async function updateLastPlayed(songId: string): Promise<void> {
  try {
    const song = await getDownloadedSong(songId);
    if (!song) return;

    song.lastPlayedAt = Date.now();

    const db = await openDB();
    const tx = db.transaction(SONG_STORE, 'readwrite');
    const store = tx.objectStore(SONG_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(song);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineStorage] Update last played error:', error);
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
  try {
    const songs = await getDownloadedSongs();
    const totalSize = songs.reduce((sum, song) => sum + song.size, 0);

    return {
      count: songs.length,
      totalSize,
      songs: songs.map(song => ({
        id: song.id,
        name: song.metadata.name,
        artist: song.metadata.artist,
        size: song.size,
        downloadedAt: song.downloadedAt,
      })),
    };
  } catch (error) {
    console.error('[OfflineStorage] Stats error:', error);
    return { count: 0, totalSize: 0, songs: [] };
  }
}

/**
 * Delete oldest songs (by last played time)
 */
export async function cleanupOldest(count: number): Promise<void> {
  try {
    const songs = await getDownloadedSongs();
    
    // Sort by lastPlayedAt (oldest first)
    const sorted = songs.sort((a, b) => a.lastPlayedAt - b.lastPlayedAt);
    
    // Delete the oldest ones
    const toDelete = sorted.slice(0, count);
    
    for (const song of toDelete) {
      await deleteSong(song.id);
      console.log('[OfflineStorage] Cleaned up:', song.metadata.name);
    }

    console.log('[OfflineStorage] Cleanup complete. Deleted', toDelete.length, 'songs');
  } catch (error) {
    console.error('[OfflineStorage] Cleanup error:', error);
  }
}

/**
 * Check if a playlist is downloaded (exists in playlists store)
 */
export async function isPlaylistDownloaded(playlistId: string): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, 'readonly');
    const store = tx.objectStore(PLAYLIST_STORE);

    return new Promise((resolve) => {
      const request = store.get(playlistId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    return false;
  }
}

/**
 * Clear all downloaded songs
 */
export async function clearAllDownloads(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([SONG_STORE, PLAYLIST_STORE], 'readwrite');
    tx.objectStore(SONG_STORE).clear();
    tx.objectStore(PLAYLIST_STORE).clear();

    console.log('[OfflineStorage] All downloads cleared');
  } catch (error) {
    console.error('[OfflineStorage] Clear all error:', error);
    throw error;
  }
}

// Export constants for UI usage
export const STORAGE_LIMITS = {
  MAX_SONGS,
  MAX_STORAGE_MB,
  MAX_STORAGE_BYTES,
};
