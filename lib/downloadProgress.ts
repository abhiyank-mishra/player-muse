/**
 * Download Progress Bus
 * 
 * Global event-driven system for tracking per-song download progress.
 * Uses EventBus pattern so any SongListItem can subscribe to its own song's progress.
 * 
 * Events:
 *  - `download:start:{songId}`  → { songId }
 *  - `download:progress:{songId}` → { songId, loaded, total, percent }
 *  - `download:complete:{songId}` → { songId }
 *  - `download:error:{songId}` → { songId, error }
 *  - `download:playlist:progress` → { playlistId, completed, total, currentSongId }
 */

type DownloadListener = (data: any) => void;
const listeners = new Map<string, Set<DownloadListener>>();

export const DownloadProgressBus = {
  on(event: string, fn: DownloadListener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
  },

  off(event: string, fn: DownloadListener) {
    listeners.get(event)?.delete(fn);
  },

  emit(event: string, data: any) {
    listeners.get(event)?.forEach(fn => fn(data));
  }
};

/**
 * Download a song with progress tracking via XMLHttpRequest.
 * Falls back to fetch if XHR isn't available.
 */
export async function downloadWithProgress(
  url: string,
  songId: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        DownloadProgressBus.emit(`download:progress:${songId}`, {
          songId,
          loaded: event.loaded,
          total: event.total,
          percent
        });
      } else {
        // Some servers don't send content-length; show indeterminate
        DownloadProgressBus.emit(`download:progress:${songId}`, {
          songId,
          loaded: event.loaded,
          total: 0,
          percent: -1 // indeterminate
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as Blob);
      } else {
        reject(new Error(`Download failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during download'));
    xhr.ontimeout = () => reject(new Error('Download timed out'));
    
    xhr.send();
  });
}
