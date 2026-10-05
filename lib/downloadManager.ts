import { CuratedPlaylist } from './types';
import { Song } from './types';
import { downloadSong, savePlaylist, DownloadedPlaylist, getStorageStats, STORAGE_LIMITS } from './offlineStorage';
import { isAdmin } from './downloadWhitelist';
import { DownloadProgressBus } from './downloadProgress';

export interface DownloadProgress {
  total: number;
  completed: number;
  currentSong?: string;
  isDownloading: boolean;
  error?: string;
}

// ─── Global Active Downloads Registry ───
// Persists across component mounts/unmounts so background downloads survive navigation
const activePlaylistDownloads = new Map<string, DownloadProgress>();

export function getActiveDownload(playlistId: string): DownloadProgress | undefined {
  return activePlaylistDownloads.get(playlistId);
}

export function isPlaylistDownloading(playlistId: string): boolean {
  return activePlaylistDownloads.get(playlistId)?.isDownloading === true;
}

export async function downloadPlaylistForOffline(
  playlist: CuratedPlaylist,
  userEmail: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const playlistId = playlist.id;

  // Prevent duplicate downloads
  if (isPlaylistDownloading(playlistId)) {
    console.log('[DownloadManager] Playlist already downloading:', playlistId);
    return;
  }

  try {
    const songs = playlist.songs || [];
    if (songs.length === 0) return;

    // Initial Progress
    let progress: DownloadProgress = {
      total: songs.length,
      completed: 0,
      isDownloading: true
    };
    activePlaylistDownloads.set(playlistId, { ...progress });
    emitPlaylistProgress(playlistId, progress);
    onProgress?.(progress);

    // Check Limits (Estimate)
    const stats = await getStorageStats();
    const isUserAdmin = isAdmin(userEmail);
    
    if (!isUserAdmin) {
       if (stats.count + songs.length > STORAGE_LIMITS.MAX_SONGS) {
         throw new Error(`Storage limit exceeded. Can't add ${songs.length} songs.`);
       }
    }

    // Save Playlist Metadata first
    const downloadedPlaylist: DownloadedPlaylist = {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        image: playlist.coverImage,
        type: 'curated',
        songCount: songs.length,
        downloadedAt: Date.now()
    };
    await savePlaylist(downloadedPlaylist);

    // Download Songs Sequentially
    for (const song of songs) {
        progress.currentSong = song.name;
        const snapshot = { ...progress };
        activePlaylistDownloads.set(playlistId, snapshot);
        emitPlaylistProgress(playlistId, snapshot);
        try { onProgress?.(snapshot); } catch {}  // Safe call — component may be unmounted

        try {
            // Pass playlistId to link song
            await downloadSong(song, userEmail, playlist.id);
        } catch (e) {
            console.warn(`Failed to download ${song.name}:`, e);
        }

        progress.completed++;
        const snap2 = { ...progress };
        activePlaylistDownloads.set(playlistId, snap2);
        emitPlaylistProgress(playlistId, snap2);
        try { onProgress?.(snap2); } catch {}
    }

    // Finish
    progress.isDownloading = false;
    progress.currentSong = undefined;
    const finalSnap = { ...progress };
    activePlaylistDownloads.delete(playlistId);
    emitPlaylistProgress(playlistId, finalSnap);
    try { onProgress?.(finalSnap); } catch {}

  } catch (error: any) {
    console.error('Playlist download failed:', error);
    activePlaylistDownloads.delete(playlistId);
    const errSnap: DownloadProgress = {
      total: 0,
      completed: 0,
      isDownloading: false,
      error: error.message || 'Download failed'
    };
    emitPlaylistProgress(playlistId, errSnap);
    try { onProgress?.(errSnap); } catch {}
    throw error;
  }
}

function emitPlaylistProgress(playlistId: string, progress: DownloadProgress) {
  DownloadProgressBus.emit('download:playlist:progress', {
    playlistId,
    ...progress,
  });
}

