"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { 
  ListMusic, 
  RotateCw, 
  X, 
  Trash2, 
  Play, 
  Music,
  GripVertical
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/contexts/ToastContext';
import { Song } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { getUserTasteSignals } from '@/lib/preferences';
import { useCoverTheme } from '@/lib/coverTheme';
import { useBackHandler } from '@/platform/useBackHandler';

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function QueueRow({
  song,
  index,
  onPlay,
  onRemove,
  onCommit,
  onDragStart,
  onDragEnd
}: {
  song: Song;
  index: number;
  onPlay: () => void;
  onRemove: () => void;
  onCommit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Reorder.Item
      value={song}
      id={song.id}
      layout="position"
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
        onCommit();
      }}
      transition={{
        type: "spring",
        stiffness: 450,
        damping: 35,
        mass: 0.5
      }}
      className={`group w-full px-4 sm:px-5 py-2.5 flex items-center gap-3 select-none border-b border-white/[0.03] last:border-b-0 transition-colors ${
        isDragging 
          ? 'bg-white/[0.08] shadow-[0_12px_30px_rgba(0,0,0,0.8)] z-50' 
          : 'bg-transparent hover:bg-white/[0.03]'
      }`}
      whileDrag={{ 
        scale: 1.02, 
        zIndex: 50
      }}
    >
      {/* Position Number */}
      <span className="text-xs font-mono font-medium text-gray-500 w-5 text-center shrink-0">
        #{index + 1}
      </span>

      {/* Artwork */}
      <div 
        onClick={onPlay}
        className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/5 relative cursor-pointer"
      >
        <img
          src={song.image?.[0] || '/logo.png'}
          alt={song.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/logo.png';
          }}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </div>
      </div>

      {/* Metadata */}
      <div onClick={onPlay} className="flex-1 min-w-0 cursor-pointer">
        <h5 className="text-xs font-medium text-white truncate group-hover:text-gray-200 transition-colors" title={song.name}>
          {song.name}
        </h5>
        <p className="text-[11px] text-gray-400 truncate" title={song.artist}>
          {song.artist}
        </p>
      </div>

      {/* Controls: Remove & Drag Handle */}
      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
          title="Remove"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="p-1.5 text-gray-500 hover:text-white cursor-grab active:cursor-grabbing transition-colors touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
    </Reorder.Item>
  );
}

export default function QueuePanel({ isOpen, onClose }: QueuePanelProps) {
  const { 
    currentSong, 
    isPlaying, 
    queue, 
    currentIndex, 
    manualQueue,
    playSong,
    removeQueueItem,
    replaceUpcomingQueue,
    isFullPlayerOpen,
    isDesktopFullScreen
  } = usePlayer();

  const isAnyFullScreen = Boolean(isFullPlayerOpen || isDesktopFullScreen);
  const { showToast } = useToast();
  
  // Intercept phone back button to close Queue first without closing Player or navigating away
  useBackHandler(isOpen, onClose, 'queuePanel');
  const coverUrl = currentSong?.image?.[0]?.replace('150x150', '500x500') || currentSong?.image?.[1] || currentSong?.image?.[0] || '/logo.png';
  const theme = useCoverTheme(coverUrl);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchingRef = useRef(false);
  
  // Safe initial check to prevent layout jump on hydration
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });
  const sheetDragControls = useDragControls();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Compute upcoming songs list with strict ID deduplication (memoized to prevent re-render loop on seek)
  const upcomingSongs = useMemo(() => {
    const rawUpcoming: Song[] = [
      ...(manualQueue || []),
      ...queue.slice(currentIndex + 1)
    ];

    const seenIds = new Set<string>();
    if (currentSong?.id) seenIds.add(currentSong.id);

    const result: Song[] = [];
    for (const song of rawUpcoming) {
      if (song && song.id && !seenIds.has(song.id)) {
        seenIds.add(song.id);
        result.push(song);
      }
    }
    return result;
  }, [manualQueue, queue, currentIndex, currentSong?.id]);

  // Up to 14 songs displayed
  const displayedSongs = useMemo(() => upcomingSongs.slice(0, 14), [upcomingSongs]);

  const [orderedSongs, setOrderedSongs] = useState<Song[]>(displayedSongs);

  const songIdsKey = useMemo(() => displayedSongs.map((s: Song) => s.id).join(','), [displayedSongs]);
  useEffect(() => {
    setOrderedSongs(displayedSongs);
  }, [songIdsKey, displayedSongs]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const isReorderingRef = useRef(false);

  // Auto-scroll ONLY when a drag reorder is actively in progress
  // Prevents layout thrashing (getBoundingClientRect) and rAF stutter during normal scrolling
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isReorderingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const topThreshold = rect.top + 70;
    const bottomThreshold = rect.bottom - 70;

    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }

    const scroll = () => {
      if (!container || !isReorderingRef.current) return;
      if (e.clientY < topThreshold && container.scrollTop > 0) {
        const factor = Math.min(1, Math.max(0.2, (topThreshold - e.clientY) / 70));
        container.scrollTop -= 12 * factor;
        autoScrollRafRef.current = requestAnimationFrame(scroll);
      } else if (e.clientY > bottomThreshold && container.scrollTop < container.scrollHeight - container.clientHeight) {
        const factor = Math.min(1, Math.max(0.2, (e.clientY - bottomThreshold) / 70));
        container.scrollTop += 12 * factor;
        autoScrollRafRef.current = requestAnimationFrame(scroll);
      }
    };

    if (e.clientY < topThreshold || e.clientY > bottomThreshold) {
      scroll();
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    isReorderingRef.current = false;
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  // Auto-replenish queue when remaining songs drop to <= 5
  useEffect(() => {
    if (!isOpen || !currentSong || upcomingSongs.length > 5 || fetchingRef.current) return;

    fetchingRef.current = true;
    const fetchMoreRecos = async () => {
      try {
        const taste = getUserTasteSignals();
        // Use the last song in the current upcoming queue as the vibe progression anchor
        const anchor = upcomingSongs.length > 0 ? upcomingSongs[upcomingSongs.length - 1] : currentSong;

        const params = new URLSearchParams({
          name: anchor.name,
          artist: anchor.artist?.split(',')[0]?.trim() || '',
          limit: '20',
          resolve: 'true'
        });

        if (taste.skippedTitles && taste.skippedTitles.length > 0) {
          params.set('skipped', JSON.stringify(taste.skippedTitles));
        }
        if (taste.likedArtists && taste.likedArtists.length > 0) {
          params.set('likedArtists', JSON.stringify(taste.likedArtists));
        }

        const res = await fetch(`/api/music/recommendations/youtube?${params}`);
        if (res.ok) {
          const recos: Song[] = await res.json();
          if (Array.isArray(recos) && recos.length > 0) {
            const cleanAlpha = (s: string) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
            const currentNorm = cleanAlpha(currentSong.name);
            const existingNorms = new Set([currentNorm, ...upcomingSongs.map((s: Song) => cleanAlpha(s.name))]);

            const fresh = recos.filter((s: Song) => {
              const norm = cleanAlpha(s.name);
              return norm && !existingNorms.has(norm);
            });

            if (fresh.length > 0) {
              replaceUpcomingQueue([...upcomingSongs, ...fresh]);
            }
          }
        }
      } catch (e) {
        console.error('Failed to replenish queue', e);
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchMoreRecos();
  }, [isOpen, currentSong?.id, upcomingSongs.length, replaceUpcomingQueue]);

  // Refresh entire upcoming queue using YouTube + user taste signals
  const handleRefresh = useCallback(async () => {
    if (!currentSong || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const taste = getUserTasteSignals();
      const params = new URLSearchParams({
        name: currentSong.name,
        artist: currentSong.artist?.split(',')[0]?.trim() || '',
        limit: '25',
        resolve: 'true',
        t: Date.now().toString()
      });

      if (taste.skippedTitles && taste.skippedTitles.length > 0) {
        params.set('skipped', JSON.stringify(taste.skippedTitles));
      }
      if (taste.likedArtists && taste.likedArtists.length > 0) {
        params.set('likedArtists', JSON.stringify(taste.likedArtists));
      }

      const res = await fetch(`/api/music/recommendations/youtube?${params}`);
      
      if (res.ok) {
        const freshRecos: Song[] = await res.json();
        if (Array.isArray(freshRecos) && freshRecos.length > 0) {
          const cleanAlpha = (s: string) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
          const currentNorm = cleanAlpha(currentSong.name);
          const seen = new Set<string>([currentNorm]);

          const filtered: Song[] = [];
          for (const s of freshRecos) {
            const norm = cleanAlpha(s.name);
            if (norm && !seen.has(norm)) {
              seen.add(norm);
              filtered.push(s);
            }
          }

          replaceUpcomingQueue(filtered);
          showToast('Queue refreshed', 'success');
        } else {
          showToast('No recommendations found', 'info');
        }
      } else {
        showToast('Failed to refresh queue', 'error');
      }
    } catch (e) {
      console.error('Queue refresh error:', e);
      showToast('Error refreshing queue', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentSong, isRefreshing, replaceUpcomingQueue, showToast]);

  const orderedSongsRef = useRef(orderedSongs);
  orderedSongsRef.current = orderedSongs;

  // Real-time 60fps smooth drag reorder (local state only - zero lag!)
  const handleReorder = useCallback((newOrder: Song[]) => {
    setOrderedSongs(newOrder);
  }, []);

  // Commit to PlayerContext ONLY when drag completes
  const handleCommitOrder = useCallback(() => {
    const current = orderedSongsRef.current;
    const remaining = upcomingSongs.slice(current.length);
    replaceUpcomingQueue([...current, ...remaining]);
  }, [upcomingSongs, replaceUpcomingQueue]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="queue-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className={`fixed inset-0 ${isAnyFullScreen ? 'z-[95]' : 'z-[75] sm:z-[75]'} bg-black/60 backdrop-blur-sm sm:backdrop-blur-md`}
        />
      )}

      {isOpen && (
        <motion.div
          key="queue-panel"
          drag={isMobile ? "y" : false}
          dragControls={sheetDragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 100 || info.velocity.y > 300) {
              onClose();
            }
          }}
          initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 12 }}
          animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 12 }}
          transition={isMobile ? { 
            type: "spring", 
            damping: 32, 
            stiffness: 340, 
            mass: 0.7 
          } : { 
            duration: 0.2, 
            ease: [0.16, 1, 0.3, 1] 
          }}
          className={`fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-28 sm:right-8 ${isAnyFullScreen ? 'z-[100]' : 'z-[100]'} w-full sm:w-[420px] sm:max-w-[calc(100vw-2rem)] h-[80vh] sm:h-auto sm:max-h-[calc(100vh-140px)] bg-[#101014] sm:bg-[#09090b]/85 sm:backdrop-blur-2xl border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.9)] sm:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden will-change-transform`}
        >
            {/* Ambient Dynamic Song Theme Glow Layers */}
            <div 
              className="absolute inset-0 pointer-events-none transition-all duration-700 opacity-40"
              style={{
                background: `radial-gradient(ellipse 130% 70% at 50% -10%, ${theme.glowRgba} 0%, ${theme.ambientRgba} 50%, transparent 85%)`
              }}
            />
            <div 
              className="absolute -top-24 -left-20 w-64 h-64 rounded-full pointer-events-none blur-3xl opacity-25 transition-all duration-700"
              style={{
                background: theme.primary
              }}
            />
            <div 
              className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full pointer-events-none blur-3xl opacity-20 transition-all duration-700"
              style={{
                background: theme.accent
              }}
            />
            {/* Subtle top rim light in song theme color */}
            <div 
              className="absolute top-0 inset-x-0 h-[1.5px] pointer-events-none transition-all duration-700 opacity-50"
              style={{
                background: `linear-gradient(90deg, transparent, ${theme.lightAccent}, transparent)`
              }}
            />

            {/* Mobile Pull Handle */}
            <div 
              onPointerDown={(e) => sheetDragControls.start(e)}
              className="w-full flex flex-col items-center pt-3 pb-1.5 sm:hidden shrink-0 relative z-20 cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <div className="w-12 h-1 bg-white/30 hover:bg-white/50 active:bg-white/70 rounded-full transition-colors" />
            </div>

            {/* Minimal Header */}
            <div 
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                if (isMobile) sheetDragControls.start(e);
              }}
              className="px-4 sm:px-5 py-2.5 border-b border-white/[0.04] flex items-center justify-between shrink-0 bg-transparent relative z-10 touch-none select-none sm:select-auto cursor-grab active:cursor-grabbing sm:cursor-default"
            >
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-gray-400" />
                <h3 className="text-gray-300 font-normal text-sm">Queue</h3>
                {upcomingSongs.length > 0 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                    {upcomingSongs.length + (currentSong ? 1 : 0)}
                  </span>
                )}
              </div>

              {/* Refresh & Close */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || !currentSong}
                  className={`p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors ${
                    isRefreshing ? 'cursor-not-allowed opacity-75' : ''
                  }`}
                  title="Refresh queue"
                >
                  <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Now Playing Section */}
            {currentSong && (
              <div className="shrink-0 relative z-10 border-b border-white/[0.04]">
                <div className="px-4 sm:px-5 pt-2.5 pb-1 flex items-center justify-between">
                  <span 
                    className="text-[10px] font-medium uppercase tracking-wider transition-colors duration-700"
                    style={{ color: theme.lightAccent }}
                  >
                    Now Playing
                  </span>
                </div>
                <div className="w-full px-4 sm:px-5 py-2.5 flex items-center gap-3 select-none hover:bg-white/[0.02] transition-colors relative">
                  {/* Subtle ambient theme gradient behind current song */}
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-15 transition-all duration-700"
                    style={{
                      background: `linear-gradient(90deg, ${theme.primary} 0%, transparent 75%)`
                    }}
                  />

                  {/* Indicator column aligned with #1, #2 */}
                  <div className="w-5 flex items-center justify-center shrink-0 relative z-10">
                    {isPlaying ? (
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 h-1.5 animate-pulse rounded-full" style={{ backgroundColor: theme.primary }} />
                        <span className="w-0.5 h-3 animate-pulse delay-100 rounded-full" style={{ backgroundColor: theme.primary }} />
                        <span className="w-0.5 h-2 animate-pulse delay-200 rounded-full" style={{ backgroundColor: theme.primary }} />
                      </div>
                    ) : (
                      <span 
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: theme.primary || '#ffffff' }}
                      />
                    )}
                  </div>

                  {/* Artwork */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden relative shrink-0 bg-white/5 border border-white/10 shadow-sm">
                    <img
                      src={currentSong.image?.[0] || '/logo.png'}
                      alt={currentSong.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/logo.png';
                      }}
                    />
                  </div>

                  {/* Metadata - Normal, clean, matching typography */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-normal text-gray-200 truncate" title={currentSong.name}>
                      {currentSong.name}
                    </h5>
                    <p className="text-[11px] text-gray-400 truncate" title={currentSong.artist}>
                      {currentSong.artist}
                    </p>
                  </div>

                  {/* Duration */}
                  <span className="text-xs font-mono text-gray-500 shrink-0 pr-1">
                    {formatTime(currentSong.duration || 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Up to 14 Upcoming Songs List with Smooth Drag-and-Drop */}
            <div 
              ref={scrollContainerRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="flex-1 overflow-y-auto overscroll-contain pb-8 sm:pb-3 relative z-10 hide-scrollbar no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="px-4 sm:px-5 pt-3 pb-1 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Up Next
                </span>
                {orderedSongs.length > 0 && (
                  <span className="text-[10px] font-mono text-gray-500">
                    {orderedSongs.length} {orderedSongs.length === 1 ? 'song' : 'songs'}
                  </span>
                )}
              </div>
              {orderedSongs.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Music className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-white text-xs font-medium">Queue is empty</p>
                  <p className="text-gray-500 text-[11px] mt-1">
                    Play a song or click Refresh to generate recommendations.
                  </p>
                </div>
              ) : (
                <Reorder.Group 
                  axis="y" 
                  values={orderedSongs} 
                  onReorder={handleReorder}
                  className="flex flex-col w-full"
                >
                  {orderedSongs.map((song, idx) => (
                    <QueueRow
                      key={song.id}
                      song={song}
                      index={idx}
                      onPlay={() => playSong(song, 'queue')}
                      onRemove={() => removeQueueItem(idx)}
                      onCommit={handleCommitOrder}
                      onDragStart={() => { isReorderingRef.current = true; }}
                      onDragEnd={() => { isReorderingRef.current = false; }}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}
