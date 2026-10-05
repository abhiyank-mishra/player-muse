"use client";

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Song, PlayerState } from '@/lib/types';
import { useAuth } from './AuthContext';
import { recordSongPlay } from '@/lib/ranking';
import { incrementGuestPlayCount, getGuestPlayCount, updateWeights, recordSkipPreference } from '@/lib/preferences';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MediaSessionBridge } from '@/core/player/MediaSessionBridge';
import { QueueManager } from '@/core/player/QueueManager';
import { PlaybackEngine, BackgroundKeepAlive, AudioPreloader } from '@/core/player/PlaybackEngine';
import { savePlayerState, loadPlayerState, clearPlayerState } from '@/core/player/PlayerStateStore';
import { requestWakeLock, releasePlayerWakeLock } from '@/core/player/WakeLockManager';

const DEBUG_IOS = true; // Temporary flag for debugging playback issues

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
        // If we think we're playing but the engine is stalled, try to recover
        if (s.isPlaying && s.currentSong && engineRef.current) {
          try {
            const currentPos = engineRef.current.seek() as number;
            const dur = engineRef.current.getInstance()?.duration() || s.duration || 0;
            // If position is at/past end and song should still be playing,
            // the onEnd likely didn't fire while backgrounded
            if (dur > 0 && currentPos >= dur - 0.5) {
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

        if (engineRef.current) {
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
    if (engineRef.current) {
      engineRef.current.seek(seconds);
    }
    setState(prev => ({ ...prev, seek: seconds }));
    MediaSessionBridge.updatePositionState(current.duration || 0, 1, seconds);
  }, []);  // No state dependency needed — reads via stateRef

  const getCurrentTime = useCallback(() => {
    if (engineRef.current) {
      try {
        const pos = engineRef.current.seek();
        return typeof pos === 'number' && !isNaN(pos) ? pos : 0;
      } catch {
        return 0;
      }
    }
    return stateRef.current.seek || 0;
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

    const isUsable = song.url && song.url.length > 0 && !song.url.includes('undefined');
    
    // ─── Offline mode: resolve blob URL from IndexedDB ───
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline || song.url?.startsWith('blob:')) {
        // If already a blob URL, proceed normally; otherwise resolve from IndexedDB
        if (!song.url?.startsWith('blob:')) {
            setState(prev => ({ ...prev, isBuffering: true }));
            import('@/lib/offlineStorage').then(async ({ getDownloadedSong }) => {
                const downloaded = await getDownloadedSong(song.id);
                if (downloaded && downloaded.blob && downloaded.blob.size > 0) {
                    const blobUrl = URL.createObjectURL(downloaded.blob);
                    console.log('[Player] Offline — using blob URL for:', song.name);
                    playSong({ ...song, url: blobUrl }, sourceContext);
                } else {
                    console.warn('[Player] Offline — song not found in IndexedDB:', song.name);
                    setState(prev => ({ ...prev, isBuffering: false, isPlaying: false }));
                    // Try next song
                    setTimeout(() => { if (nextSongRef.current) nextSongRef.current(); }, 300);
                }
            }).catch(e => {
                console.error('[Player] Offline blob resolution failed:', e);
                setState(prev => ({ ...prev, isBuffering: false, isPlaying: false }));
            });
            return;
        }
    }
    
    if (!isUsable && song.source !== 'youtube') {
        setState(prev => ({ ...prev, isBuffering: true }));
        fetch(`/api/music/fallback?query=${encodeURIComponent(song.name + ' ' + song.artist)}`)
            .then(res => res.json())
            .then(data => {
                if (data.url) playSong({ ...song, ...data }, sourceContext);
                else setState(prev => ({ ...prev, isBuffering: false }));
            })
            .catch(e => {
                console.error("Fallback fetch error", e);
                setState(prev => ({ ...prev, isBuffering: false }));
            });
        return; 
    }

    setState(prev => {
        // When restoring from a persisted session, skip radio queue generation
        // (the queue is already restored) and skip history push (we're resuming,
        // not switching songs).
        const isRestore = sourceContext === 'restore';
        const isFromQueue = sourceContext === 'queue' || sourceContext === 'next';
        const isColab = sourceContext === 'colab';
        const isStandalone = !isRestore && !isFromQueue && !isColab;

        if (isStandalone) {
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
            history: isRestore ? prev.history : QueueManager.pushHistory(prev.history, prev.currentSong)
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
            setState(prev => ({ ...prev, isBuffering: false, duration }));
            // Update MediaSession with actual loaded duration so Android notification progress bar works
            const currentSeek = engineRef.current?.seek() as number || 0;
            MediaSessionBridge.updatePositionState(duration, 1, currentSeek);
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
                // On locked phones the Howler callback can run in a restricted
                // context; deferring with setTimeout gives the browser a chance
                // to schedule the next audio play in a fresh microtask.
                setTimeout(() => {
                    if (nextSongRef.current) {
                        nextSongRef.current();
                    } else {
                        console.warn('[Player] nextSongRef is null in onEnd — playback will stop');
                    }
                }, 0);
            }
        },
        onLoadError: (id, err) => {
            console.error("Load Error", err);
            if (DEBUG_IOS) console.log("[Player] Details:", { id, err });
            
            // For load failure, auto-skip to next song after brief delay
            console.log("[Player] Load failed for:", song.name, "— auto-skipping to next song");
            setState(prev => ({ ...prev, isBuffering: false, isPlaying: false }));
            setTimeout(() => {
                if (nextSongRef.current) nextSongRef.current();
            }, 200);
        },
        onPlayError: (id, err) => console.warn("Playback wait (autoplay blocked):", err)
    });
    
    engineRef.current.play();

    // Instantiate core MediaSession bindings decoupled logic
    MediaSessionBridge.updateMetadata(song);
    MediaSessionBridge.setActionHandlers({
        onPlay: () => engineRef.current?.play() || setState(prev => ({ ...prev, isPlaying: true })),
        onPause: () => engineRef.current?.pause() || setState(prev => ({ ...prev, isPlaying: false })),
        onNextTrack: () => { if (nextSongRef.current) nextSongRef.current() },
        onPrevTrack: () => { if (prevSongRef.current) prevSongRef.current() },
        onSeekTo: seekTo
    });
    MediaSessionBridge.setPlaybackState(true);

    if (user) recordSongPlay(user.uid, song);
  }, [user, state.volume, seekTo]);

  // ─── Restore persisted state on mount ───
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const persisted = loadPlayerState();
    if (!persisted || !persisted.currentSong) return;

    console.log('[Player] Restoring session:', persisted.currentSong.name, 'at', Math.round(persisted.seek), 's');

    // Restore queue/state first so playSong sees the correct queue
    setState(prev => ({
      ...prev,
      queue: persisted.queue,
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

      const songToPlay = persisted.currentSong;
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
    if (!engineRef.current) return;
    const s = stateRef.current;
    if (s.isPlaying) engineRef.current.pause();
    else engineRef.current.play();
    MediaSessionBridge.setPlaybackState(!s.isPlaying);
  }, []);

  const pause = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
    MediaSessionBridge.setPlaybackState(false);
  }, []);

  const resume = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.play();
    setState(prev => ({ ...prev, isPlaying: true }));
    MediaSessionBridge.setPlaybackState(true);
  }, []);

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
  }, [playSong]);  // Removed `state` dependency — we read from stateRef instead

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
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};
