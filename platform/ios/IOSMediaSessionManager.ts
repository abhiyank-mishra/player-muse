import { Song } from '@/lib/types';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeekTo: (seconds: number) => void;
}

export class IOSMediaSessionManager {
  private static artworkUrl: string | null = null;

  static async updateMetadata(song: Song) {
    if (!('mediaSession' in navigator)) return;

    // iOS often fails to load remote artwork on lock screen due to CORS or networking in sleep mode
    // We attempt to localize/proxy it if it's external
    let artworkUrl = Array.isArray(song.image) ? (song.image[1] || song.image[0]) : song.image;

    if (artworkUrl && (artworkUrl.startsWith('http'))) {
        try {
            const proxyUrl = `/api/music/proxy?url=${encodeURIComponent(artworkUrl)}`;
            const res = await fetch(proxyUrl);
            if (res.ok) {
                const blob = await res.blob();
                if (this.artworkUrl) URL.revokeObjectURL(this.artworkUrl);
                this.artworkUrl = URL.createObjectURL(blob);
                artworkUrl = this.artworkUrl;
            }
        } catch (e) {
            console.warn("[IOS Media] Artwork proxy failed", e);
        }
    }

    const artwork = [
      { src: artworkUrl || '/android-chrome-512x512.png', sizes: '512x512', type: 'image/jpeg' }
    ];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: song.artist || 'Unknown Artist',
      album: song.album || 'Muse Music',
      artwork
    });
  }

  static setActionHandlers(callbacks: MediaSessionCallbacks) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', callbacks.onPlay);
    navigator.mediaSession.setActionHandler('pause', callbacks.onPause);
    navigator.mediaSession.setActionHandler('previoustrack', callbacks.onPrevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', callbacks.onNextTrack);
    
    // iOS Safari supports seekto
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        callbacks.onSeekTo(details.seekTime);
      }
    });
  }

  static updatePositionState(duration: number, playbackRate: number, position: number) {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration || 0,
          playbackRate: playbackRate,
          position: position || 0,
        });
      } catch (e) {
          // Ignore state errors
      }
    }
  }

  static setPlaybackState(state: 'playing' | 'paused' | 'none') {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = state;
    }
  }
}
