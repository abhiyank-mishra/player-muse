"use client";

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Song, PlayerState } from '@/lib/types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { recordSongPlay } from '@/lib/ranking';
import { incrementGuestPlayCount, getGuestPlayCount, updateWeights, recordSkipPreference } from '@/lib/preferences';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import '@/core/player/YouTubePlayerPatch';
import { MediaSessionBridge } from '@/core/player/MediaSessionBridge';
import { QueueManager } from '@/core/player/QueueManager';
import { PlaybackEngine, BackgroundKeepAlive, AudioPreloader } from '@/core/player/PlaybackEngine';
import { savePlayerState, loadPlayerState, clearPlayerState } from '@/core/player/PlayerStateStore';
import { requestWakeLock, releasePlayerWakeLock } from '@/core/player/WakeLockManager';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false }) as any;
const DEBUG_IOS = true; // Temporary flag for debugging playback issues

export const formatYouTubeUrl = (urlOrSong?: string | { id?: string; url?: string } | null): string => {
  if (!urlOrSong) return '';
  let target = '';
  if (typeof urlOrSong === 'object') {
    if (urlOrSong.id && urlOrSong.id.startsWith('yt_')) {
      return `https://www.youtube.com/watch?v=${urlOrSong.id.replace(/^yt_/, '')}`;
    }
    target = urlOrSong.url || urlOrSong.id || '';
  } else {
    target = urlOrSong;
  }
  const trimmed = target.trim();
  if (!trimmed) return '';
  if (trimmed.includes('/api/music/stream')) {
    try {
      const urlObj = new URL(trimmed, 'http://dummy.com');
      const id = urlObj.searchParams.get('id');
      if (id) return `https://www.youtube.com/watch?v=${id.replace(/^yt_/, '')}`;
    } catch {}
  }
  if (trimmed.startsWith('yt_')) {
    return `https://www.youtube.com/watch?v=${trimmed.replace(/^yt_/, '')}`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://www.youtube.com/watch?v=${trimmed}`;
};

interface PlayerContextType extends PlayerState {
  history: Song[];
  isFullPlayerOpen: boolean;
  setFullPlayerOpen: (open: boolean) => void;
  isDesktopFullScreen: boolean;
  setDesktopFullScreen: (open: boolean) => void;
  isQueueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  toggleQueue: () => void;
  removeQueueItem: (upcomingIndex: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  replaceUpcomingQueue: (newUpcoming: Song[]) => void;
  playSong: (song: Song, sourceContext?: string) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextSong: () => void;
  prevSong: () => void;
  addToQueue: (song: Song) => void;
  setQueueConfig: (songs: Song[], startIndex?: number) => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  playNext: (song: Song) => void;
  setNextSongOverride: (handler: (() => void) | null) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, setLoginModalOpen } = useAuth();
  const { showToast } = useToast();
  const recoveryRef = useRef<{
    songId: string;
    attempt: number;
    triedUrls: Set<string>;
    isUserInitiated: boolean;
  }>({ songId: '', attempt: 0, triedUrls: new Set(), isUserInitiated: false });
  const router = useRouter();
  const [isFullPlayerOpen, setFullPlayerOpen] = useState(false);
  const [isDesktopFullScreen, setDesktopFullScreen] = useState(false);
  const [isQueueOpen, setQueueOpen] = useState(false);
  const toggleQueue = useCallback(() => setQueueOpen(prev => !prev), []);
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentSong: null,
    volume: 0.8,
    seek: 0,
    duration: 0,
    queue: [],
    manualQueue: [],
    currentIndex: -1,
    isBuffering: false,
    isShuffle: false,
    repeatMode: 'off',
    history: [],
  });

  const engineRef = useRef<PlaybackEngine | null>(null);
  const playerRef = useRef<any>(null); // ReactPlayer ref
  const rafRef = useRef<number | null>(null);
  const repeatModeRef = useRef(state.repeatMode);
  const nextSongRef = useRef<(() => void) | undefined>(undefined);
  const prevSongRef = useRef<(() => void) | undefined>(undefined);
  const hasRestoredRef = useRef(false); // prevents double-restore
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state); // always-fresh ref for event handlers
  const nextSongOverrideRef = useRef<(() => void) | null>(null);
  const recordedWeightSongIdRef = useRef<string | null>(null);

  const setNextSongOverride = useCallback((handler: (() => void) | null) => {
    nextSongOverrideRef.current = handler;
  }, []);

  // Keep refs in sync
  useEffect(() => {
    repeatModeRef.current = state.repeatMode;
  }, [state.repeatMode]);

  // Keep stateRef always current
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ─── Persist player state (debounced) ───
  const lastSavedSeekRef = useRef(0);
  useEffect(() => {
    if (!state.currentSong) return; // nothing to persist
    // Skip persist if only seek changed (seek updates ~1/sec during playback)
    const seekDelta = Math.abs(state.seek - lastSavedSeekRef.current);
    const isSeekOnly = seekDelta > 0 && seekDelta < 10;
    if (isSeekOnly && state.isPlaying) return; // Don't thrash during normal playback
    
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePlayerState(state);
      lastSavedSeekRef.current = state.seek;
    }, 3000); // debounce 3s to avoid thrashing
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state.currentSong?.id, state.queue.length, state.currentIndex, state.volume, state.isShuffle, state.repeatMode]);

  // ─── Save immediately on page hide / beforeunload ───
  useEffect(() => {
    const saveNow = () => {
      if (stateRef.current.currentSong) {
        savePlayerState(stateRef.current);
      }
    };
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', onVisChange);
    // Also save on 'pagehide' for mobile browsers that skip beforeunload
    window.addEventListener('pagehide', saveNow);
    return () => {
      window.removeEventListener('beforeunload', saveNow);
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('pagehide', saveNow);
    };
  }, []);

  // ─── Wake Lock + Background KeepAlive integration ───
  useEffect(() => {
    if (state.isPlaying) {
      requestWakeLock();
      BackgroundKeepAlive.start();
    } else {
      releasePlayerWakeLock();
      BackgroundKeepAlive.stop();
    }
  }, [state.isPlaying]);

  useEffect(() => {
    return () => {
      engineRef.current?.unload();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      releasePlayerWakeLock();
      BackgroundKeepAlive.stop();
    };
  }, []);

  // ─── Background recovery: detect if playback died while backgrounded ───
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const s = stateRef.current;
        if (!s.isPlaying || !s.currentSong) return;

        // For YouTube tracks: NEVER use engineRef.current (which is a silent audio loop)
        if (s.currentSong.source === 'youtube') {
          if (playerRef.current) {
            try {
              const p = playerRef.current;
              const ytDur = typeof p.duration === 'number' ? p.duration : (p.getDuration ? p.getDuration() : 0);
              const ytPos = typeof p.currentTime === 'number' ? p.currentTime : (p.getCurrentTime ? p.getCurrentTime() : 0);
              if (ytDur > 10 && typeof ytPos === 'number' && ytPos >= ytDur - 0.2) {
                console.log('[Player] Recovery: YouTube song ended while backgrounded, advancing...');
                if (nextSongRef.current) nextSongRef.current();
              }
            } catch (e) {
              // Ignore
            }
          }
          return;
        }

        // For non-YouTube tracks (Howler / HTML5 Audio)
        if (engineRef.current) {
          try {
            const howl = engineRef.current.getInstance();
            if (!howl) return;

            // If audio is actively playing, NEVER interrupt playback!
            if (howl.playing()) return;

            const audioNode = (howl as any)?._sounds?.[0]?._node as HTMLAudioElement | undefined;
            const isAudioEnded = audioNode ? audioNode.ended : false;
            const dur = typeof howl.duration === 'function' ? howl.duration() : (s.duration || 0);
            const currentPos = typeof engineRef.current.seek() === 'number' ? (engineRef.current.seek() as number) : 0;

            // Only advance if the audio element literally reported ended,
            // or if the song duration is valid (>10s) and position reached EOF
            if (isAudioEnded || (dur > 10 && currentPos >= dur)) {
              console.log('[Player] Recovery: song ended while backgrounded, advancing...');
              if (nextSongRef.current) nextSongRef.current();
            }
          } catch (e) {
            // Engine may have been unloaded
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (state.isPlaying) {
      interval = setInterval(() => {
        const currentSong = stateRef.current.currentSong;
        let currentSeek: number | null = null;
        let activeDuration = 0;

        if (currentSong?.source === 'youtube') {
          if (playerRef.current) {
            const p = playerRef.current;
            const time = typeof p.currentTime === 'number' ? p.currentTime : (p.getCurrentTime ? p.getCurrentTime() : null);
            if (typeof time === 'number' && !isNaN(time)) currentSeek = time;
            const dur = typeof p.duration === 'number' && !isNaN(p.duration) ? p.duration : (p.getDuration ? p.getDuration() : (stateRef.current.duration || currentSong.duration || 0));
            activeDuration = dur;
          }
        } else if (engineRef.current) {
          currentSeek = engineRef.current.seek() as number;
          activeDuration = engineRef.current.getInstance()?.duration() || stateRef.current.duration || currentSong?.duration || 0;
        }

        if (typeof currentSeek === 'number' && !isNaN(currentSeek)) {
          setState(prev => {
            if (Math.abs(prev.seek - currentSeek!) < 1) return prev;
            return { ...prev, seek: currentSeek! };
          });

          // Record user taste weights when song has been listened to for >= 30s OR >= 50% of duration
          if (currentSong && recordedWeightSongIdRef.current !== currentSong.id) {
            if (currentSeek >= 30 || (activeDuration > 0 && currentSeek / activeDuration >= 0.5)) {
              recordedWeightSongIdRef.current = currentSong.id;
              updateWeights(currentSong, currentSeek, activeDuration);
            }
          }
        }
      }, 1000); // 1-second interval ensures background tracking and avoids UI lockups
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isPlaying]);

  const seekTo = useCallback((seconds: number) => {
    const current = stateRef.current;
    if (engineRef.current && current.currentSong?.source !== 'youtube') {
      // PlaybackEngine now safely queues seeks on unloaded audio
      engineRef.current.seek(seconds);
    }
    if (current.currentSong?.source === 'youtube' && playerRef.current) {
      const p = playerRef.current;
      try {
        if (typeof p.seekTo === 'function') {
          p.seekTo(seconds, true);
        } else if ('currentTime' in p) {
          p.currentTime = seconds;
        } else if (p.api && typeof p.api.seekTo === 'function') {
          p.api.seekTo(seconds, true);
        } else if (p.getInternalPlayer && typeof p.getInternalPlayer === 'function') {
          const internal = p.getInternalPlayer();
          if (internal && typeof internal.seekTo === 'function') {
            internal.seekTo(seconds, true);
          } else if (internal && 'currentTime' in internal) {
            internal.currentTime = seconds;
          }
        }
      } catch (err) {
        console.warn('[Player] YouTube seek failed:', err);
      }
    }
    setState(prev => ({ ...prev, seek: seconds }));
    MediaSessionBridge.updatePositionState(current.duration || 0, 1, seconds);
  }, []);  // No state dependency needed — reads via stateRef

  const getCurrentTime = useCallback(() => {
    const current = stateRef.current;
    if (current.currentSong?.source === 'youtube' && playerRef.current) {
      const p = playerRef.current;
      const pos = typeof p.currentTime === 'number' ? p.currentTime : (p.getCurrentTime ? p.getCurrentTime() : null);
      if (typeof pos === 'number' && !isNaN(pos)) return pos;
      return current.seek || 0;
    }
    if (engineRef.current) {
      try {
        const pos = engineRef.current.seek();
        return typeof pos === 'number' && !isNaN(pos) ? pos : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }, []);

  const playSong = useCallback((song: Song, sourceContext?: string) => {
    engineRef.current?.unload();
    recordedWeightSongIdRef.current = null;

    if (!user && !authLoading) {
        const playCount = getGuestPlayCount();
        if (playCount >= 5) {
            // Show login modal instead of hard redirect — avoids flash on refresh
            setLoginModalOpen(true);
            setState(prev => ({ ...prev, isPlaying: false }));
            return;
        }
        incrementGuestPlayCount();
    }

    if (song.source === 'youtube') {
        song = { ...song, url: formatYouTubeUrl(song) };
    }

    const isRestore = sourceContext === 'restore';
    const isFromQueue = sourceContext === 'queue';
    const isNext = sourceContext === 'next';
    const isColab = sourceContext === 'colab';
    const isRetry = sourceContext === 'retry';
    const isStandalone = !isRestore && !isFromQueue && !isNext && !isColab && !isRetry;
    const isUserInitiated = isStandalone || isFromQueue;

    // Track recovery attempts per song
    if (!isRetry && recoveryRef.current.songId !== song.id) {
        recoveryRef.current = {
            songId: song.id,
            attempt: 0,
            triedUrls: new Set(song.url ? [song.url] : []),
            isUserInitiated
        };
    } else if (song.url) {
        recoveryRef.current.triedUrls.add(song.url);
    }

    const isUsable = Boolean(song.url && typeof song.url === 'string' && song.url.trim().length > 0 && !song.url.includes('undefined'));
    
    // ─── Offline mode: resolve blob URL from IndexedDB ───
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline || song.url?.startsWith('blob:')) {
        // If already a blob URL, proceed normally; otherwise resolve from IndexedDB
        if (!song.url?.startsWith('blob:')) {
            setState(prev => ({ ...prev, isBuffering: true, currentSong: song }));
            import('@/lib/offlineStorage').then(async ({ getDownloadedSong }) => {
                const downloaded = await getDownloadedSong(song.id);
                if (downloaded && downloaded.blob && downloaded.blob.size > 0) {
                    const blobUrl = URL.createObjectURL(downloaded.blob);
                    console.log('[Player] Offline — using blob URL for:', song.name);
                    playSong({ ...song, url: blobUrl }, sourceContext);
                } else {
                    console.warn('[Player] Offline — song not found in IndexedDB:', song.name);
                    setState(prev => ({ ...prev, isBuffering: false, isPlaying: false }));
                    if (recoveryRef.current.isUserInitiated) {
                        showToast(`Offline: "${song.name}" is not downloaded.`, 'error');
                    } else {
                        setTimeout(() => { if (nextSongRef.current) nextSongRef.current(); }, 300);
                    }
                }
            }).catch(e => {
                console.error('[Player] Offline blob resolution failed:', e);
                setState(prev => ({ ...prev, isBuffering: false, isPlaying: false }));
            });
            return;
        }
    }
    
    // ─── Pre-flight resolution if audio URL is missing ───
    if (!isUsable && song.source !== 'youtube') {
        setState(prev => ({ ...prev, isBuffering: true, currentSong: song }));
        console.log('[Player] Song has no usable URL, resolving before playback:', song.name, song.id);

        const handleUnresolvable = () => {
            console.warn('[Player] Failed to resolve URL for:', song.name);
            setState(prev => ({ ...prev, isBuffering: false, isPlaying: false }));
            if (recoveryRef.current.isUserInitiated) {
                showToast(`Unable to play "${song.name}". Stream unavailable.`, 'error');
            } else {
                setTimeout(() => { if (nextSongRef.current) nextSongRef.current(); }, 200);
            }
        };

        const tryFallbackSearch = () => {
            fetch(`/api/music/fallback?query=${encodeURIComponent(song.name + ' ' + (song.artist || ''))}&title=${encodeURIComponent(song.name)}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.url) {
                        console.log('[Player] Got URL from fallback search for:', song.name);
                        playSong({ ...song, ...data }, isRetry ? 'retry' : sourceContext);
                    } else {
                        handleUnresolvable();
                    }
                })
                .catch(() => handleUnresolvable());
        };

        // If numeric ID, first try direct song details API
        const isNumericId = /^\d+$/.test(song.id);
        if (isNumericId) {
            fetch(`/api/music/song/${song.id}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.url) {
                        console.log('[Player] Got URL from song details API for:', song.name);
                        playSong({ ...song, ...data }, isRetry ? 'retry' : sourceContext);
                    } else {
                        tryFallbackSearch();
                    }
                })
                .catch(() => tryFallbackSearch());
        } else {
            tryFallbackSearch();
        }
        return; 
    }

    setState(prev => {
        // When restoring or retrying, skip radio queue generation
        const shouldGenerateRadio = isStandalone && !isRetry;

        if (shouldGenerateRadio) {
             import('@/core/player/RadioQueueGenerator').then(mod => {
                 mod.RadioQueueGenerator.generateQueue(song).then(radioQueue => {
                     setState(current => {
                         if (current.currentSong?.id === song.id) {
                             const existingIds = new Set([song.id]);
                             const fresh = (radioQueue || []).filter(s => !existingIds.has(s.id));
                             return { ...current, queue: [song, ...fresh], currentIndex: 0 };
                         }
                         return current;
                     });
                 });
             });
        }
        
        // Reset MediaSession position on song change to stop previous timeline sync issue
        MediaSessionBridge.updatePositionState(song.duration || 0, 1, 0);

        const existingIndex = prev.queue.findIndex(s => s.id === song.id);

        return {
            ...prev,
            currentSong: song,
            isPlaying: true,
            isBuffering: true,
            duration: song.duration, 
            seek: 0,
            queue: isStandalone ? [song] : prev.queue,
            currentIndex: isStandalone ? 0 : (sourceContext === 'next' ? prev.currentIndex : (existingIndex !== -1 ? existingIndex : prev.currentIndex)),
            manualQueue: isStandalone ? [] : prev.manualQueue,
            history: (isRestore || isRetry) ? prev.history : QueueManager.pushHistory(prev.history, prev.currentSong)
        };
    });

    if (DEBUG_IOS) {
        console.log(`[Player] Playing: ${song.name} from ${song.source}`);
        console.log(`[Player] URL: ${song.url}`);
    }
    
    // Cancel any background preloading to ensure full bandwidth for active playback
    AudioPreloader.clear();
    
    // Instantiate core PlaybackEngine decoupled logic
    engineRef.current = new PlaybackEngine(song, state.volume, {
        onLoad: (duration) => {
            // Success! Reset recovery tracker
            recoveryRef.current = { songId: '', attempt: 0, triedUrls: new Set(), isUserInitiated: false };
            setState(prev => ({ ...prev, isBuffering: false, duration: duration || song.duration || 0 }));
            // Update MediaSession with actual loaded duration so Android notification progress bar works
            const currentSeek = engineRef.current?.seek() as number || 0;
            MediaSessionBridge.updatePositionState(duration || song.duration || 0, 1, currentSeek);
        },
        onPlay: () => {
             setState(prev => ({ ...prev, isPlaying: true, isBuffering: false }));
             MediaSessionBridge.setPlaybackState(true);
             const currentSeek = engineRef.current?.seek() as number || 0;
             // Use engine's duration if available, fallback to song.duration
             const activeDuration = engineRef.current?.getInstance()?.duration() || song.duration || 0;
             MediaSessionBridge.updatePositionState(activeDuration, 1, currentSeek);
        },
        onPause: () => {
            setState(prev => ({ ...prev, isPlaying: false }));
            MediaSessionBridge.setPlaybackState(false);
        },
        onEnd: () => {
            if (DEBUG_IOS) console.log('[Player] onEnd fired — repeatMode:', repeatModeRef.current);

            // Record full song listen into user taste profile
            if (song && recordedWeightSongIdRef.current !== song.id) {
                recordedWeightSongIdRef.current = song.id;
                const activeDuration = engineRef.current?.getInstance()?.duration() || song.duration || 0;
                updateWeights(song, activeDuration, activeDuration);
            }

            if (repeatModeRef.current === 'one') {
                engineRef.current?.seek(0);
                engineRef.current?.play();
            } else {
                // Use setTimeout(0) to break out of the Howler callback stack.
                setTimeout(() => {
                    if (nextSongRef.current) {
                        nextSongRef.current();
                    } else {
                        console.warn('[Player] nextSongRef is null in onEnd — playback will stop');
                    }
                }, 0);
            }
        },
        onLoadError: async (id, err) => {
            console.error(`[Player] Load Error for "${song.name}" (attempt ${recoveryRef.current.attempt}):`, err);
            const currentRecovery = recoveryRef.current;
            currentRecovery.attempt += 1;
            const attempt = currentRecovery.attempt;

            // Tier 1: Bitrate degradation on direct CDN (320 -> 160 -> 96 kbps)
            if (song.url && song.url.includes('saavncdn.com')) {
                if (song.url.includes('_320.mp4')) {
                    const alt160 = song.url.replace('_320.mp4', '_160.mp4');
                    if (!currentRecovery.triedUrls.has(alt160)) {
                        currentRecovery.triedUrls.add(alt160);
                        console.log('[Player] Recovery Tier 1: Trying 160kbps CDN URL for:', song.name);
                        playSong({ ...song, url: alt160 }, 'retry');
                        return;
                    }
                }
                if (song.url.includes('_320.mp4') || song.url.includes('_160.mp4')) {
                    const alt96 = song.url.replace(/_(320|160)\.mp4/, '_96.mp4');
                    if (!currentRecovery.triedUrls.has(alt96)) {
                        currentRecovery.triedUrls.add(alt96);
                        console.log('[Player] Recovery Tier 1: Trying 96kbps CDN URL for:', song.name);
                        playSong({ ...song, url: alt96 }, 'retry');
                        return;
                    }
                }
            }

            // Tier 2: Muse Streaming Proxy (handles iOS Range 206, CORS, and auto-bitrate fallback)
            if (song.url && !song.url.includes('/api/music/proxy') && (song.url.startsWith('http://') || song.url.startsWith('https://'))) {
                const proxyUrl = `/api/music/proxy?url=${encodeURIComponent(song.url)}`;
                if (!currentRecovery.triedUrls.has(proxyUrl)) {
                    currentRecovery.triedUrls.add(proxyUrl);
                    console.log('[Player] Recovery Tier 2: Trying Muse Streaming Proxy for:', song.name);
                    playSong({ ...song, url: proxyUrl }, 'retry');
                    return;
                }
            }

            // Tier 3: Re-fetch fresh song details via JioSaavn API (if numeric ID)
            const isNumericId = /^\d+$/.test(song.id);
            if (isNumericId && attempt <= 3) {
                console.log('[Player] Recovery Tier 3: Re-fetching track details for:', song.name);
                try {
                    const res = await fetch(`/api/music/song/${song.id}`);
                    if (res.ok) {
                        const freshData = await res.json();
                        if (freshData?.url && !currentRecovery.triedUrls.has(freshData.url)) {
                            currentRecovery.triedUrls.add(freshData.url);
                            playSong({ ...song, ...freshData }, 'retry');
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[Player] Recovery Tier 3 re-fetch failed:', e);
                }
            }

            // Tier 4: Cross-platform fallback search (verified match)
            if (attempt <= 4) {
                console.log('[Player] Recovery Tier 4: Fallback search for:', song.name);
                try {
                    const res = await fetch(`/api/music/fallback?query=${encodeURIComponent(song.name + ' ' + (song.artist || ''))}&title=${encodeURIComponent(song.name)}`);
                    if (res.ok) {
                        const fallbackData = await res.json();
                        if (fallbackData?.url && !currentRecovery.triedUrls.has(fallbackData.url)) {
                            currentRecovery.triedUrls.add(fallbackData.url);
                            playSong({ ...song, url: fallbackData.url, source: fallbackData.source || song.source }, 'retry');
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[Player] Recovery Tier 4 fallback search failed:', e);
                }
            }

            // Tier 5: All recovery attempts failed
            console.error('[Player] All playback recovery options exhausted for:', song.name);
            setState(prev => ({ ...prev, isBuffering: false, isPlaying: false }));

            if (currentRecovery.isUserInitiated) {
                // NEVER jump to a random next song when user explicitly chose this song!
                showToast(`Could not play "${song.name}". Stream unavailable.`, 'error');
            } else {
                // Background queue playback: advance to next song after delay
                setTimeout(() => {
                    if (nextSongRef.current) nextSongRef.current();
                }, 200);
            }
        },
        onPlayError: (id, err) => {
            console.warn("Playback wait (autoplay blocked):", err);
            setState(prev => ({ ...prev, isBuffering: false }));
        }
    });
    
    engineRef.current.play();

    // Instantiate core MediaSession bindings decoupled logic
    MediaSessionBridge.updateMetadata(song);
    MediaSessionBridge.setActionHandlers({
        onPlay: () => {
            if (stateRef.current.currentSong?.source === 'youtube') {
                setState(prev => ({ ...prev, isPlaying: true }));
                engineRef.current?.play();
            } else {
                engineRef.current?.play() || setState(prev => ({ ...prev, isPlaying: true }));
            }
        },
        onPause: () => {
            if (stateRef.current.currentSong?.source === 'youtube') {
                setState(prev => ({ ...prev, isPlaying: false }));
                engineRef.current?.pause();
            } else {
                engineRef.current?.pause() || setState(prev => ({ ...prev, isPlaying: false }));
            }
        },
        onNextTrack: () => { if (nextSongRef.current) nextSongRef.current() },
        onPrevTrack: () => { if (prevSongRef.current) prevSongRef.current() },
        onSeekTo: seekTo
    });
    MediaSessionBridge.setPlaybackState(true);

    if (user) recordSongPlay(user.uid, song);
  }, [user, authLoading, setLoginModalOpen, state.volume, seekTo, showToast]);

  // ─── Restore persisted state on mount ───
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const persisted = loadPlayerState();
    if (!persisted || !persisted.currentSong) return;

    console.log('[Player] Restoring session:', persisted.currentSong.name, 'at', Math.round(persisted.seek), 's');

    // Restore queue/state first so playSong sees the correct queue
    const sanitizedQueue = (persisted.queue || []).map(s => {
      if (s?.source === 'youtube') {
        return { ...s, url: formatYouTubeUrl(s) };
      }
      return s;
    });

    setState(prev => ({
      ...prev,
      queue: sanitizedQueue,
      manualQueue: persisted.manualQueue,
      currentIndex: persisted.currentIndex,
      volume: persisted.volume,
      isShuffle: persisted.isShuffle,
      repeatMode: persisted.repeatMode,
      history: persisted.history,
    }));

    // Small delay so the setState above is committed before playSong reads state
    const resumeTimer = setTimeout(async () => {
      if (!persisted.currentSong) return;

      let songToPlay = persisted.currentSong;

      if (songToPlay.source === 'youtube') {
        songToPlay = { ...songToPlay, url: formatYouTubeUrl(songToPlay) };
      }

      playSong(songToPlay, 'restore');
      // Seek to saved position after a brief loading delay
      const seekTimer = setTimeout(() => {
        if (persisted.seek > 2) {
          seekTo(persisted.seek);
        }
      }, 800);
      return () => clearTimeout(seekTimer);
    }, 100);
    return () => clearTimeout(resumeTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount

  const togglePlay = useCallback(() => {
    if (!user && !authLoading && getGuestPlayCount() >= 5) {
      setLoginModalOpen(true);
      return;
    }
    const s = stateRef.current;
    if (s.isPlaying) {
      if (engineRef.current) engineRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
      MediaSessionBridge.setPlaybackState(false);
    } else {
      if (engineRef.current) engineRef.current.play();
      setState(prev => ({ ...prev, isPlaying: true }));
      MediaSessionBridge.setPlaybackState(true);
    }
  }, [user, authLoading, setLoginModalOpen]);

  const pause = useCallback(() => {
    if (engineRef.current) engineRef.current.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
    MediaSessionBridge.setPlaybackState(false);
  }, []);

  const resume = useCallback(() => {
    if (!user && !authLoading && getGuestPlayCount() >= 5) {
      setLoginModalOpen(true);
      return;
    }
    if (engineRef.current) engineRef.current.play();
    setState(prev => ({ ...prev, isPlaying: true }));
    MediaSessionBridge.setPlaybackState(true);
  }, [user, authLoading, setLoginModalOpen]);

  const nextSong = useCallback(async () => {
    // If an external mode (e.g. Colab room) registered an override, delegate to it
    if (nextSongOverrideRef.current) {
      if (DEBUG_IOS) console.log('[Player] nextSong overridden by external handler (e.g. Colab)');
      nextSongOverrideRef.current();
      return;
    }

    // CRITICAL: Read from stateRef.current (always-fresh) instead of the
    // stale closure `state`.  When the phone is locked the browser throttles
    // JS, so the `onEnd` callback often fires with a very old `state` closure.
    // Using the ref guarantees we see the latest queue, index, and repeat mode.
    const s = stateRef.current;

    if (DEBUG_IOS) console.log('[Player] nextSong() called — index:', s.currentIndex, 'queue:', s.queue.length, 'manualQ:', s.manualQueue?.length);

    // Record implicit skip penalty if song was skipped early before weight threshold was reached
    if (s.currentSong && recordedWeightSongIdRef.current !== s.currentSong.id) {
      const activeDuration = engineRef.current?.getInstance()?.duration() || s.duration || s.currentSong.duration || 0;
      recordSkipPreference(s.currentSong, s.seek, activeDuration);
    }

    // === Step 1: Synchronous resolution (works even when backgrounded) ===
    let track: Song | null = null;
    let index = s.currentIndex;
    let newQueue = s.queue;
    let newManualQueue = s.manualQueue || [];

    // 1a. Manual queue has priority
    if (newManualQueue.length > 0) {
        track = newManualQueue[0];
        newManualQueue = newManualQueue.slice(1);
    } else {
        // 1b. Regular queue progression
        let nextIndex = s.currentIndex + 1;
        if (s.isShuffle && s.queue.length > 1) {
            let randomIndex = s.currentIndex;
            let attempts = 0;
            while (randomIndex === s.currentIndex && attempts < 10) {
                randomIndex = Math.floor(Math.random() * s.queue.length);
                attempts++;
            }
            nextIndex = randomIndex;
        } else if (nextIndex >= s.queue.length) {
            if (s.repeatMode === 'all') nextIndex = 0;
            else if (s.repeatMode === 'one') nextIndex = s.currentIndex;
        }

        if (nextIndex < s.queue.length) {
             track = s.queue[nextIndex];
             index = nextIndex;
        }
    }

    // === Step 2: Play if we found a track synchronously ===
    if (track) {
        setState(prev => ({ ...prev, currentIndex: index, queue: newQueue, manualQueue: newManualQueue }));
        playSong(track, 'next');

        // === Step 2b: Pre-fetch more songs if 4-5 songs remain in queue ===
        const remainingInQueue = newQueue.length - index - 1;
        if (remainingInQueue <= 5 && s.currentSong) {
            import('@/core/player/RadioQueueGenerator').then(mod => {
                mod.RadioQueueGenerator.generateQueue(track!).then(radioQueue => {
                    if (radioQueue && radioQueue.length > 0) {
                        setState(current => {
                            const existingIds = new Set(current.queue.map(s => s.id));
                            const newSongs = radioQueue.filter(s => !existingIds.has(s.id));
                            if (newSongs.length > 0) {
                                return { ...current, queue: [...current.queue, ...newSongs] };
                            }
                            return current;
                        });
                    }
                }).catch(() => { /* silent */ });
            }).catch(() => { /* silent */ });
        }
        return;
    }

    // === Step 3: Queue exhausted ===
    const seedSong = s.currentSong;
    if (!seedSong) {
        setState(prev => ({ ...prev, isPlaying: false }));
        return;
    }

    // === Step 3a: OFFLINE MODE — loop within existing queue ===
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
        // When offline, simply loop back to the beginning of the queue
        if (s.queue.length > 0) {
            console.log('[Player] Offline — looping queue from start');
            const loopIndex = 0;
            setState(prev => ({ ...prev, currentIndex: loopIndex, manualQueue: [] }));
            // Keep MediaSession alive during transition
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
            }
            playSong(s.queue[loopIndex], 'next');
        } else {
            // Absolutely nothing to play
            console.warn('[Player] Offline — queue empty, stopping');
            setState(prev => ({ ...prev, isPlaying: false }));
        }
        return;
    }

    // === Step 3b: ONLINE MODE — generate smart radio queue ===
    try {
        const { RadioQueueGenerator } = await import('@/core/player/RadioQueueGenerator');
        const queuePromise = RadioQueueGenerator.generateQueue(seedSong);

        // Shorter timeout for background scenarios
        const timeoutPromise = new Promise<Song[]>((resolve) =>
            setTimeout(() => resolve([]), 8000)
        );

        const recSongs: Song[] = await Promise.race([queuePromise, timeoutPromise]);

        if (recSongs && recSongs.length > 0) {
            const latest = stateRef.current;
            const existingIds = new Set(latest.queue.map(s => s.id));
            const freshRecs = recSongs.filter(s => !existingIds.has(s.id));
            if (freshRecs.length > 0) {
                const nextTrack = freshRecs[0];
                const newQ = [...latest.queue, ...freshRecs];
                setState(prev => ({ ...prev, currentIndex: prev.queue.length, queue: newQ, manualQueue: [] }));
                playSong(nextTrack, 'next');
                return;
            }
        }

        // 3c. Fallback: trending songs
        const trendRes = await Promise.race([
            fetch('/api/music/trending').then(r => r.ok ? r.json() : []).catch(() => []),
            new Promise<Song[]>(resolve => setTimeout(() => resolve([]), 3000))
        ]);

        if (trendRes && trendRes.length > 0) {
            const latest = stateRef.current;
            const existingIds = new Set(latest.queue.map(s => s.id));
            const freshTrending = trendRes.filter((s: Song) => !existingIds.has(s.id));
            if (freshTrending.length > 0) {
                setState(prev => ({ ...prev, currentIndex: prev.queue.length, queue: [...prev.queue, ...freshTrending], manualQueue: [] }));
                playSong(freshTrending[0], 'next');
                return;
            }
        }

        // 3d. Nothing worked — stop playback
        console.warn('[Player] All next-song fallbacks exhausted');
        setState(prev => ({ ...prev, isPlaying: false }));
    } catch (e) {
        console.warn('[Player] nextSong async fallback failed:', e);
        setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [playSong]);

  const prevSong = useCallback(() => {
     const s = stateRef.current;
     const currentSeek = engineRef.current?.seek() || 0;
     const { track, newHistory, newIndex } = QueueManager.getPrevious(s, currentSeek as number);
     
     if (currentSeek > 3 && s.currentSong) {
         engineRef.current?.seek(0);
         return;
     }

     setState(prev => ({ ...prev, history: newHistory, currentIndex: newIndex }));
     if (track) setTimeout(() => playSong(track, 'queue'), 0);
  }, [playSong]);

  useEffect(() => {
    nextSongRef.current = nextSong;
    prevSongRef.current = prevSong;
  }, [nextSong, prevSong]);

  // ─── Preload upcoming track audio & pre-resolve fallback streaming URLs ───
  const preloadUpcomingTrack = useCallback((currentState: PlayerState) => {
    let nextTrack: Song | null = null;
    if (currentState.manualQueue && currentState.manualQueue.length > 0) {
      nextTrack = currentState.manualQueue[0];
    } else if (currentState.queue && currentState.queue.length > 0) {
      const nextIndex = currentState.currentIndex + 1;
      if (nextIndex < currentState.queue.length) {
        nextTrack = currentState.queue[nextIndex];
      } else if (currentState.repeatMode === 'all') {
        nextTrack = currentState.queue[0];
      }
    }

    if (!nextTrack) return;

    // 1. If next track lacks a usable streaming URL and isn't YouTube, pre-resolve it via fallback
    const isUsable = nextTrack.url && nextTrack.url.length > 0 && !nextTrack.url.includes('undefined');
    if (!isUsable && nextTrack.source !== 'youtube') {
      const targetId = nextTrack.id;
      const query = `${nextTrack.name} ${nextTrack.artist}`;
      fetch(`/api/music/fallback?query=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.url) {
            setState(prev => {
              const updatedQueue = prev.queue.map(s => s.id === targetId ? { ...s, ...data } : s);
              const updatedManual = (prev.manualQueue || []).map(s => s.id === targetId ? { ...s, ...data } : s);
              return { ...prev, queue: updatedQueue, manualQueue: updatedManual };
            });
            AudioPreloader.preload(data.url);
          }
        })
        .catch(() => {});
      return;
    }

    // 2. If it already has a usable URL, preload the audio bytes into HTTP cache
    if (nextTrack.url && nextTrack.source !== 'youtube') {
      AudioPreloader.preload(nextTrack.url);
    }
  }, []);

  useEffect(() => {
    if (!state.isPlaying || !state.currentSong) return;

    const timer = setTimeout(() => {
      preloadUpcomingTrack(stateRef.current);
    }, 1500);

    return () => clearTimeout(timer);
  }, [state.currentSong?.id, state.currentIndex, state.isPlaying, preloadUpcomingTrack]);

  const addToQueue = useCallback((song: Song) => {
    setState(prev => {
        if (!prev.currentSong && prev.queue.length === 0 && (!prev.manualQueue || prev.manualQueue.length === 0)) {
           setTimeout(() => playSong(song), 0);
           return prev;
        }
        return { ...prev, manualQueue: [...(prev.manualQueue || []), song] };
    });
  }, [playSong]);
  
  const setQueueConfig = useCallback((songs: Song[], startIndex = 0) => {
      setState(prev => ({ ...prev, queue: songs, currentIndex: startIndex }));
      if(songs[startIndex]) playSong(songs[startIndex], 'queue');
  }, [playSong]);
  
  const setVolume = useCallback((vol: number) => {
    engineRef.current?.volume(vol);
    setState(prev => ({ ...prev, volume: vol }));
  }, []);

  // ReactPlayer Callbacks
  const handlePlayerProgress = (progress: { playedSeconds: number }) => {
      if (state.currentSong?.source === 'youtube') {
          setState(prev => ({ ...prev, seek: progress.playedSeconds }));
          const currentSong = state.currentSong;
          if (currentSong && recordedWeightSongIdRef.current !== currentSong.id) {
              const dur = state.duration || currentSong.duration || 0;
              if (progress.playedSeconds >= 30 || (dur > 0 && progress.playedSeconds / dur >= 0.5)) {
                  recordedWeightSongIdRef.current = currentSong.id;
                  updateWeights(currentSong, progress.playedSeconds, dur);
              }
          }
      }
  };

  const handlePlayerDuration = (duration: number) => {
      if (state.currentSong?.source === 'youtube') setState(prev => ({ ...prev, duration }));
  };

  const handlePlayerEnded = () => {
       const currentSong = state.currentSong;
       if (currentSong && recordedWeightSongIdRef.current !== currentSong.id) {
           recordedWeightSongIdRef.current = currentSong.id;
           const dur = state.duration || currentSong.duration || 0;
           updateWeights(currentSong, dur, dur);
       }
       if (repeatModeRef.current === 'one') {
          if (playerRef.current) {
            const p = playerRef.current;
            try {
              if (typeof p.seekTo === 'function') {
                p.seekTo(0, true);
              } else if ('currentTime' in p) {
                p.currentTime = 0;
              } else if (p.api && typeof p.api.seekTo === 'function') {
                p.api.seekTo(0, true);
              }
            } catch (err) {
              console.warn('[Player] YouTube repeat seek failed:', err);
            }
            setState(prev => ({ ...prev, isPlaying: true }));
          }
       } else {
          if (nextSongRef.current) nextSongRef.current();
       }
  };

  const toggleShuffle = useCallback(() => setState(prev => ({ ...prev, isShuffle: !prev.isShuffle })), []);
  const toggleRepeat = useCallback(() => {
      setState(prev => {
          const modes: ('off' | 'one' | 'all')[] = ['off', 'all', 'one'];
          const nextIndex = (modes.indexOf(prev.repeatMode) + 1) % modes.length;
          return { ...prev, repeatMode: modes[nextIndex] };
      });
  }, []);

  const playNext = useCallback((song: Song) => {
    setState(prev => ({
      ...prev,
      manualQueue: [song, ...(prev.manualQueue || [])]
    }));
  }, []);

  const removeQueueItem = useCallback((upcomingIndex: number) => {
    setState(prev => {
      const manualCount = prev.manualQueue?.length || 0;
      if (upcomingIndex < manualCount) {
        const newManual = [...(prev.manualQueue || [])];
        newManual.splice(upcomingIndex, 1);
        return { ...prev, manualQueue: newManual };
      } else {
        const queueRelativeIdx = (prev.currentIndex + 1) + (upcomingIndex - manualCount);
        if (queueRelativeIdx < prev.queue.length) {
          const newQueue = [...prev.queue];
          newQueue.splice(queueRelativeIdx, 1);
          return { ...prev, queue: newQueue };
        }
        return prev;
      }
    });
  }, []);

  const moveQueueItem = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const currentUpcoming = [...(prev.manualQueue || []), ...prev.queue.slice(prev.currentIndex + 1)];
      if (fromIndex < 0 || fromIndex >= currentUpcoming.length || toIndex < 0 || toIndex >= currentUpcoming.length) {
        return prev;
      }
      const [moved] = currentUpcoming.splice(fromIndex, 1);
      currentUpcoming.splice(toIndex, 0, moved);
      const newQueue = [...prev.queue.slice(0, prev.currentIndex + 1), ...currentUpcoming];
      return {
        ...prev,
        manualQueue: [],
        queue: newQueue
      };
    });
  }, []);

  const replaceUpcomingQueue = useCallback((newUpcoming: Song[]) => {
    setState(prev => {
      const newQueue = [...prev.queue.slice(0, prev.currentIndex + 1), ...newUpcoming];
      return {
        ...prev,
        manualQueue: [],
        queue: newQueue
      };
    });
  }, []);

  const contextValue = useMemo(() => ({
      ...state, playSong, togglePlay, pause, resume, nextSong, prevSong, addToQueue, setQueueConfig,
      seekTo, getCurrentTime, setVolume, toggleShuffle, toggleRepeat, playNext, setNextSongOverride,
      isFullPlayerOpen, setFullPlayerOpen,
      isDesktopFullScreen, setDesktopFullScreen,
      isQueueOpen, setQueueOpen, toggleQueue,
      removeQueueItem, moveQueueItem, replaceUpcomingQueue
  }), [state, playSong, togglePlay, pause, resume, nextSong, prevSong, addToQueue, setQueueConfig, seekTo, getCurrentTime, setVolume, toggleShuffle, toggleRepeat, playNext, setNextSongOverride, isFullPlayerOpen, setFullPlayerOpen, isDesktopFullScreen, setDesktopFullScreen, isQueueOpen, setQueueOpen, toggleQueue, removeQueueItem, moveQueueItem, replaceUpcomingQueue]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}>
        {state.currentSong?.source === 'youtube' && (() => {
            const ytUrl = formatYouTubeUrl(state.currentSong);
            if (!ytUrl) return null;
            return (
              // @ts-ignore
              <ReactPlayer
                  key={state.currentSong.id}
                  ref={playerRef}
                  src={ytUrl}
                  playing={state.isPlaying}
                  volume={state.volume}
                  onPlay={() => setState(prev => ({ ...prev, isPlaying: true, isBuffering: false }))}
                  onPlaying={() => setState(prev => ({ ...prev, isPlaying: true, isBuffering: false }))}
                  onWaiting={() => setState(prev => ({ ...prev, isBuffering: true }))}
                  onPause={() => setState(prev => ({ ...prev, isPlaying: false }))}
                  onTimeUpdate={(e: any) => {
                      const currentSec = e?.currentTarget?.currentTime ?? e?.target?.currentTime ?? playerRef.current?.currentTime;
                      if (typeof currentSec === 'number' && !isNaN(currentSec)) {
                          handlePlayerProgress({ playedSeconds: currentSec });
                      }
                  }}
                  onDurationChange={(e: any) => {
                      const dur = e?.target?.duration ?? e?.currentTarget?.duration ?? (playerRef.current?.getDuration ? playerRef.current.getDuration() : playerRef.current?.duration);
                      if (dur && typeof dur === 'number' && !isNaN(dur)) handlePlayerDuration(dur);
                  }}
                  onReady={() => {
                      const dur = playerRef.current?.duration ?? (playerRef.current?.getDuration ? playerRef.current.getDuration() : 0);
                      if (dur && typeof dur === 'number' && !isNaN(dur)) handlePlayerDuration(dur);
                      setState(prev => ({ ...prev, isBuffering: false }));
                  }}
                  onEnded={handlePlayerEnded}
                  onError={(err: any) => {
                      console.warn('[Player] YouTube playback error:', err);
                      setState(prev => ({ ...prev, isBuffering: false }));
                  }}
                  config={{ youtube: { playerVars: { playsinline: 1 } } }}
              />
            );
        })()}
      </div>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};
