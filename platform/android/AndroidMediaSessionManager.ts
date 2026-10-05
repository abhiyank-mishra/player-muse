import { Song } from '@/lib/types';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeekTo: (seconds: number) => void;
}

export class AndroidMediaSessionManager {
  static updateMetadata(song: Song) {
    if (!('mediaSession' in navigator)) return;

    let artworkUrl = Array.isArray(song.image) ? (song.image[2] || song.image[1] || song.image[0]) : song.image;
    if (!artworkUrl || typeof artworkUrl !== 'string') {
        artworkUrl = '/android-chrome-512x512.png';
    }

    try {
      const artwork = [
        { src: artworkUrl, sizes: '96x96', type: 'image/png' },
        { src: artworkUrl, sizes: '128x128', type: 'image/png' },
        { src: artworkUrl, sizes: '192x192', type: 'image/png' },
        { src: artworkUrl, sizes: '256x256', type: 'image/png' },
        { src: artworkUrl, sizes: '384x384', type: 'image/png' },
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
      ];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name,
        artist: song.artist || 'Unknown Artist',
        album: song.album || 'Muse - Premium Music',
        artwork
      });
    } catch (e) {
      console.warn("Failed to set MediaMetadata:", e);
    }
  }

  static setActionHandlers(callbacks: MediaSessionCallbacks) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', callbacks.onPlay);
    navigator.mediaSession.setActionHandler('pause', callbacks.onPause);
    navigator.mediaSession.setActionHandler('previoustrack', callbacks.onPrevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', callbacks.onNextTrack);
    
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
        // Fallback for older browsers
      }
    }
  }

  static setPlaybackState(state: 'playing' | 'paused' | 'none') {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = state;
    }
  }
}
