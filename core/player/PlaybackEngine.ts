import { Howl } from 'howler';
import { Song } from '@/lib/types';

export const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * BackgroundKeepAlive — Maintains a persistent, near-silent <audio> element
 * that loops continuously while music is playing. This is the key mechanism
 * that prevents mobile browsers (iOS Safari, Chrome Android) from suspending
 * the web app's JS context when the screen is locked or the app is backgrounded.
 *
 * Without an active audio element, browsers detect "no media playing" during
 * the gap between songs (onEnd → nextSong) and immediately freeze/kill the tab.
 * This silent loop bridges that gap.
 */
export class BackgroundKeepAlive {
  private static audioEl: HTMLAudioElement | null = null;
  private static running = false;

  static start() {
    if (this.running) return;
    if (typeof document === 'undefined') return;

    try {
      if (!this.audioEl) {
        this.audioEl = document.createElement('audio');
        this.audioEl.src = SILENT_AUDIO_URI;
        this.audioEl.loop = true;
        this.audioEl.volume = 0.01; // Near-silent but non-zero (some browsers ignore volume=0)
        this.audioEl.setAttribute('playsinline', 'true');
        // Keep it in the DOM so the browser sees an active media element
        this.audioEl.style.position = 'fixed';
        this.audioEl.style.top = '-9999px';
        document.body.appendChild(this.audioEl);
      }
      const playPromise = this.audioEl.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay blocked — will start on next user interaction
        });
      }
      this.running = true;
    } catch (e) {
      // Silent fail — this is a best-effort mechanism
    }
  }

  static stop() {
    if (!this.running || !this.audioEl) return;
    try {
      this.audioEl.pause();
      this.running = false;
    } catch (e) {
      // Silent fail
    }
  }

  static isRunning() {
    return this.running;
  }
}

/**
 * AudioPreloader — Preloads upcoming audio streams into the browser's HTTP cache.
 * When the next song is triggered, the audio buffer is already warm, eliminating
 * initial connection/download latency and providing instant playback.
 */
export class AudioPreloader {
  private static preloadedUrl: string | null = null;
  private static controller: AbortController | null = null;

  static preload(url?: string | null) {
    if (!url || typeof window === 'undefined') return;
    if (url === this.preloadedUrl) return;
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (url.includes('youtube.com') || url.includes('youtu.be')) return;

    if (this.controller) {
      try {
        this.controller.abort();
      } catch {}
    }
    this.controller = new AbortController();
    this.preloadedUrl = url;

    // Fetch the first 128KB with Range header to warm DNS, TCP, TLS and browser HTTP cache
    // without creating an HTMLAudioElement that blocks Chrome's audio pipeline.
    fetch(url, {
      headers: { Range: 'bytes=0-131072' },
      signal: this.controller.signal,
      mode: 'no-cors',
    }).catch(() => {
      // Best-effort warm-up — fail silently
    });
  }

  static clear() {
    if (this.controller) {
      try {
        this.controller.abort();
      } catch {}
      this.controller = null;
    }
    this.preloadedUrl = null;
  }
}

export interface PlaybackCallbacks {
    onLoad: (duration: number) => void;
    onPlay: () => void;
    onPause: () => void;
    onEnd: () => void;
    onLoadError: (id: number, err: any) => void;
    onPlayError: (id: number, err: any) => void;
}

export class PlaybackEngine {
    private sound: Howl | null = null;
    private loaded = false;
    private pendingSeek: number | null = null;
    
    constructor(
        private song: Song, 
        private volumeLevel: number, 
        private callbacks: PlaybackCallbacks
    ) {
        this.init();
    }

    private init() {
        if (!this.song.url || typeof this.song.url !== 'string' || this.song.url.trim() === '' || this.song.url.includes('undefined')) {
            console.warn('[PlaybackEngine] Cannot initialize Howler without a valid URL:', this.song.name, this.song.url);
            this.loaded = false;
            this.callbacks.onLoadError(0, new Error('Invalid or missing audio URL'));
            return;
        }
        this.sound = new Howl({
            src: [this.song.url],
            html5: true, // Required for CORS streams/redirects
            format: this.song.source === 'soundcloud' || (typeof this.song.url === 'string' && this.song.url.includes('soundcloud'))
                ? ['mp3']
                : ['mp4', 'mp3', 'aac', 'm4a', 'wav'],
            volume: this.volumeLevel,
            preload: true, // Start loading immediately
            onload: () => {
                this.loaded = true;
                const duration = this.sound?.duration() || 0;
                this.callbacks.onLoad(duration);
                // If a seek was requested before loading finished, apply it now
                if (this.pendingSeek !== null) {
                    const seekTo = this.pendingSeek;
                    this.pendingSeek = null;
                    this.sound?.seek(seekTo);
                }
            },
            onplay: this.callbacks.onPlay,
            onpause: this.callbacks.onPause,
            onend: () => {
                // CRITICAL: Keep MediaSession in 'playing' state during the
                // song transition. If we let it drop to 'paused'/'none',
                // mobile browsers will kill the tab before nextSong() fires.
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'playing';
                }
                this.callbacks.onEnd();
            },
            onloaderror: (id, err) => {
                console.error("Howler Load Error:", err, "URL:", this.song.url);
                this.loaded = false;
                this.callbacks.onLoadError(id, err);
            },
            onplayerror: (id, err) => {
                console.warn("Howler Play Error (Autoplay block):", err);
                this.callbacks.onPlayError(id, err);
                if (this.sound) {
                    this.sound.once('unlock', () => {
                        this.sound?.play();
                    });
                }
            },
        });
    }

    play() {
        if (this.sound) this.sound.play();
    }

    pause() {
        if (this.sound) this.sound.pause();
    }

    unload() {
        this.loaded = false;
        this.pendingSeek = null;
        if (this.sound) this.sound.unload();
    }

    /**
     * Seek safely — if audio hasn't loaded yet, the seek is queued and
     * will be applied once onload fires. This prevents the crash that
     * happened when users skipped forward on a still-loading SoundCloud track.
     */
    seek(seconds?: number): number {
        if (!this.sound) return 0;
        if (seconds !== undefined) {
            if (this.loaded) {
                try {
                    this.sound.seek(seconds);
                } catch (e) {
                    console.warn('[PlaybackEngine] seek() failed, queuing:', e);
                    this.pendingSeek = seconds;
                }
            } else {
                // Audio not loaded yet — queue the seek for when it finishes loading
                this.pendingSeek = seconds;
            }
            return seconds;
        }
        try {
            return this.sound.seek() as number;
        } catch {
            return 0;
        }
    }

    isLoaded(): boolean {
        return this.loaded;
    }

    volume(level: number) {
        if (this.sound) this.sound.volume(level);
        this.volumeLevel = level;
    }

    getInstance(): Howl | null {
        return this.sound;
    }
}
