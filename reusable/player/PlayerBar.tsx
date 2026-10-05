"use client";
import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useColab } from '@/contexts/ColabContext';
import { toggleLike, checkIfLiked, getUserPlaylists, addToPlaylist } from '@/lib/ranking';
import { canDownload } from '@/lib/downloadWhitelist';
import { downloadSong, isDownloaded as checkIsDownloaded } from '@/lib/offlineStorage';
import { DownloadProgressBus } from '@/lib/downloadProgress';
import { AnimatePresence } from 'framer-motion';
import EventBus from '@/core/events/EventBus';
import { useToast } from '@/contexts/ToastContext';
import DesktopPlayer from '@/platform/web/DesktopPlayer';
import MobileMiniPlayer from '@/platform/android/MobileMiniPlayer';
import DesktopFullScreenPlayer from '@/platform/web/DesktopFullScreenPlayer';
import { useBackHandler } from '@/platform/useBackHandler';
import { useUI } from '@/contexts/UIContext';
import ProPurchaseModal from '@/reusable/ui/modals/ProPurchaseModal';
import QueuePanel from './QueuePanel';

export default function PlayerBar() {
  const [showPlaylistsModal, setShowPlaylistsModal] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(-1);
  const { showToast } = useToast();
  const { isProModalOpen, setProModalOpen, openAddToPlaylist } = useUI();
  const { user, isAdmin, isPro, login } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  
  const { 
    currentSong, 
    isPlaying, 
    togglePlay, 
    nextSong, 
    prevSong, 
    seek, 
    duration, 
    seekTo, 
    getCurrentTime,
    volume, 
    setVolume,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    isFullPlayerOpen: isExpanded,
    setFullPlayerOpen: setIsExpanded,
    isDesktopFullScreen,
    setDesktopFullScreen,
    isQueueOpen,
    setQueueOpen,
    toggleQueue
  } = usePlayer();

  const handleCloseQueue = React.useCallback(() => setQueueOpen(false), [setQueueOpen]);

  const { isInRoom, isColabLocked, broadcastSeek, playNextInColabQueue, playPrevInColabSong } = useColab();

  const handleTogglePlay = () => {
    if (isColabLocked) {
      showToast('Host controls playback in this room', 'info');
      return;
    }
    togglePlay();
  };

  const isTransitioningRef = useRef(false);

  const handleNextSong = () => {
    if (isColabLocked) {
      showToast('Host controls playback in this room', 'info');
      return;
    }
    if (isInRoom) {
      playNextInColabQueue();
      return;
    }
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setTimeout(() => { isTransitioningRef.current = false; }, 350);
    nextSong();
  };

  const handlePrevSong = () => {
    if (isColabLocked) {
      showToast('Host controls playback in this room', 'info');
      return;
    }
    if (isInRoom) {
      playPrevInColabSong();
      return;
    }
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setTimeout(() => { isTransitioningRef.current = false; }, 350);
    prevSong();
  };
  
  // Intercept hardware/swipe backs to close the player overlay
  useBackHandler(isExpanded || isDesktopFullScreen, () => {
    setIsExpanded(false);
    setDesktopFullScreen(false);
  }, 'fullPlayer');

  // Local seek state for smooth dragging without audio glitches
  const [localSeek, setLocalSeek] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const toggleFullScreen = () => {
    setDesktopFullScreen(!isDesktopFullScreen);
  };

  // Swipe gesture state (Refs for performance)
  const touchStartRef = useRef<number>(0);
  const touchEndRef = useRef<number>(0);
  const swipeDetected = useRef(false);
  const [showLikeTooltip, setShowLikeTooltip] = useState(false);
  const minSwipeDistance = 40;

  useEffect(() => {
    // Show tooltip if first time playing and user hasn't seen it
    if (isPlaying && !hasSeenLikeTooltip()) {
        const timer = setTimeout(() => {
            setShowLikeTooltip(true);
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [isPlaying]);

  const hasSeenLikeTooltip = () => {
      if (typeof window === 'undefined') return true;
      return localStorage.getItem('seenLikeTooltip') === 'true';
  };

  const markLikeTooltipSeen = () => {
      setShowLikeTooltip(false);
      localStorage.setItem('seenLikeTooltip', 'true');
  };

  // Check if current song is downloaded
  const currentSongId = currentSong?.id;
  useEffect(() => {
    if (currentSongId) {
      checkIsDownloaded(currentSongId).then(setIsDownloaded);
      setDownloading(false);
      setDownloadPercent(-1);
    }
  }, [currentSongId]);

  // Subscribe to download progress for current song
  useEffect(() => {
    if (!currentSongId) return;
    const sid = currentSongId;
    const onStart = () => { setDownloading(true); setDownloadPercent(0); };
    const onProgress = (data: any) => { setDownloadPercent(data.percent >= 0 ? data.percent : -1); };
    const onComplete = () => { setDownloading(false); setDownloadPercent(100); setIsDownloaded(true); };
    const onError = () => { setDownloading(false); setDownloadPercent(-1); };

    DownloadProgressBus.on(`download:start:${sid}`, onStart);
    DownloadProgressBus.on(`download:progress:${sid}`, onProgress);
    DownloadProgressBus.on(`download:complete:${sid}`, onComplete);
    DownloadProgressBus.on(`download:error:${sid}`, onError);

    return () => {
      DownloadProgressBus.off(`download:start:${sid}`, onStart);
      DownloadProgressBus.off(`download:progress:${sid}`, onProgress);
      DownloadProgressBus.off(`download:complete:${sid}`, onComplete);
      DownloadProgressBus.off(`download:error:${sid}`, onError);
    };
  }, [currentSongId]);

  // Handle download
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentSong || downloading || isDownloaded) return;

    if (!isPro) {
      setProModalOpen(true);
      return;
    }

    setDownloading(true);
    setDownloadPercent(0);

    try {
      await downloadSong(currentSong, user?.email ?? undefined);
      // Bus handles state transitions
    } catch (error) {
      console.error('[Download] Error:', error);
      setDownloading(false);
      setDownloadPercent(-1);
      showToast('Download failed. Please try again.', 'error');
    }
  };

  const handleShare = async () => {
    if (!currentSong) return;
    
    // Construct deep link — include source param for SoundCloud so the song page can resolve it
    const sourceSuffix = currentSong.source === 'soundcloud' ? '?source=soundcloud' : '';
    const url = `${window.location.origin}/song/${currentSong.id}${sourceSuffix}`;
    
    const shareData = {
        title: `Listen to ${currentSong.name}`,
        text: `Listen to ${currentSong.name} by ${currentSong.artist} on Muse - Premium Ad-Free Music.`,
        url: url
    };

    // 1. Try Native Share (Mobile)
    if (navigator.share) {
        try { 
            await navigator.share(shareData); 
            return;
        } catch(e) {
            console.log("Native share cancelled/failed", e);
            // On mobile, if native share fails/cancels, DO NOT Copy to clipboard.
            return; 
        }
    } 

    // 2. Clipboard with Legacy Fallback
    const copyToClipboard = async (text: string) => {
        // Try Modern API first
        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                // Silently fail to legacy
            }
        }
        
        // Legacy Textarea Hack
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            console.error("Copy failed", err);
            return false;
        }
    };

    if (await copyToClipboard(url)) {
        showToast('Link copied to clipboard!');
    } else {
        prompt("Copy link manually:", url);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = 0;
    touchStartRef.current = e.targetTouches[0].clientX;
    swipeDetected.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    // If no end recorded (tap) or start is 0, ignore
    if (!touchStartRef.current || !touchEndRef.current) return;
    
    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe || isRightSwipe) {
      swipeDetected.current = true;
      if (isColabLocked) {
        e.stopPropagation();
        return;
      }
      if (isRightSwipe) {
        handlePrevSong();
      } else if (isLeftSwipe) {
        handleNextSong();
      }
      e.stopPropagation();
    }
  };

  // Sync local seek with global seek when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalSeek(seek);
    }
  }, [seek, isDragging]);

  // Refs for current state to avoid Effect re-binding
  const seekRef = useRef(seek);
  const durationRef = useRef(duration);
  const localSeekRef = useRef(localSeek);

  useEffect(() => {
      seekRef.current = seek;
      durationRef.current = duration;
  }, [seek, duration]);
  
  // Keep localSeekRef in sync
  useEffect(() => {
      localSeekRef.current = localSeek;
  }, [localSeek]);

  // Unified Handlers (Memoized for useEffect usage)
  const handleSeekStart = React.useCallback(() => {
    if (isColabLocked) return;
    setIsDragging(true);
  }, [isColabLocked]);

  const handleSeekCommit = React.useCallback(() => {
    if (isColabLocked) return;
    setIsDragging(false);
    const target = localSeekRef.current;
    seekTo(target);
    if (isInRoom) {
      broadcastSeek(target);
    }
  }, [isColabLocked, seekTo, isInRoom, broadcastSeek]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isColabLocked) return;
    if (!isDragging) setIsDragging(true);
    setLocalSeek(Number(e.target.value));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key.toLowerCase() === 'f') {
        // Toggle Full Screen
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            e.preventDefault();
            toggleFullScreen();
        }
      } else if (e.code === 'ArrowRight') {
        if (isColabLocked) return;
        e.preventDefault();
        setIsDragging(true); // Treat as dragging
        setLocalSeek(prev => Math.min(durationRef.current, prev + 5));
      } else if (e.code === 'ArrowLeft') {
        if (isColabLocked) return;
        e.preventDefault();
        setIsDragging(true); // Treat as dragging
        setLocalSeek(prev => Math.max(0, prev - 5));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
         if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

         if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
             if (isColabLocked) return;
             e.preventDefault();
             handleSeekCommit();
         }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleTogglePlay, handleSeekCommit, isColabLocked]);

  useEffect(() => {
    if (user && currentSong) {
      checkIfLiked(user.uid, currentSong.id).then(setIsLiked);
    } else {
      setIsLiked(false);
    }

    // Live update listener
    const handleLikeUpdate = (data: any) => {
        if (currentSong && data?.songId === currentSong.id) {
            setIsLiked(data.isLiked);
        }
    };

    EventBus.on('likeStateChanged', handleLikeUpdate);
    return () => EventBus.off('likeStateChanged', handleLikeUpdate);
  }, [user, currentSong]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    if (!currentSong) return;
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    try {
      await toggleLike(user.uid, currentSong, isAdmin);
      // Notify app to refresh trending
      EventBus.emit('likeChanged');
    } catch (error) {
      console.error("Like failed", error);
      setIsLiked(!newLiked);
    }
  };

  const handlePlaylistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    if (currentSong) {
      openAddToPlaylist(currentSong);
    }
  };

  const handleAddToPlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !currentSong) return;
    setAddingToId(playlistId);
    try {
      await addToPlaylist(user.uid, playlistId, currentSong);
      setShowPlaylistsModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingToId(null);
    }
  };

  if (!currentSong) return null;

  return (
    <>
      <AnimatePresence>
        {(isDesktopFullScreen || isExpanded) && (
            <DesktopFullScreenPlayer 
                currentSong={currentSong}
                isPlaying={isPlaying}
                isLiked={isLiked}
                seek={seek}
                duration={duration}
                volume={volume}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                localSeek={localSeek}
                playlists={playlists}
                showPlaylistsModal={showPlaylistsModal}
                addingToId={addingToId}
                isDownloaded={isDownloaded}
                downloading={downloading}
                downloadPercent={downloadPercent}
                canDownload={canDownload(user?.email, isPro)}
                isPro={isPro}
                isControlDisabled={isColabLocked}
                onTogglePlay={handleTogglePlay}
                onNext={handleNextSong}
                onPrev={handlePrevSong}
                onSeekStart={handleSeekStart}
                onSeekChange={handleSeekChange}
                onSeekCommit={handleSeekCommit}
                onVolumeChange={setVolume}
                onToggleShuffle={toggleShuffle}
                onToggleRepeat={toggleRepeat}
                onLike={handleLike}
                onPlaylistClick={handlePlaylistClick}
                onAddToPlaylist={handleAddToPlaylist}
                onClosePlaylist={() => setShowPlaylistsModal(false)}
                onDownload={handleDownload}
                onMinimize={() => {
                  setIsExpanded(false);
                  setDesktopFullScreen(false);
                }}
                onSeek={seekTo}
                getCurrentTime={getCurrentTime}
                isQueueOpen={isQueueOpen}
                onToggleQueue={toggleQueue}
            />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isExpanded && !isDesktopFullScreen && (
          <DesktopPlayer 
            currentSong={currentSong}
            isPlaying={isPlaying}
            isLiked={isLiked}
            seek={seek}
            duration={duration}
            volume={volume}
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            localSeek={localSeek}
            playlists={playlists}
            showPlaylistsModal={showPlaylistsModal}
            addingToId={addingToId}
            isDownloaded={isDownloaded}
            downloading={downloading}
            downloadPercent={downloadPercent}
            canDownload={canDownload(user?.email, isPro)}
            isPro={isPro}
            isControlDisabled={isColabLocked}
            onTogglePlay={handleTogglePlay}
            onNext={handleNextSong}
            onPrev={handlePrevSong}
            onSeekStart={handleSeekStart}
            onSeekChange={handleSeekChange}
            onSeekCommit={handleSeekCommit}
            onVolumeChange={setVolume}
            onToggleShuffle={toggleShuffle}
            onToggleRepeat={toggleRepeat}
            onLike={handleLike}
            onPlaylistClick={handlePlaylistClick}
            onAddToPlaylist={handleAddToPlaylist}
            onClosePlaylist={() => setShowPlaylistsModal(false)}
            onDownload={handleDownload}
            onToggleFullScreen={toggleFullScreen}
            isQueueOpen={isQueueOpen}
            onToggleQueue={toggleQueue}
            getCurrentTime={getCurrentTime}
          />
        )}
      </AnimatePresence>

      {!isExpanded && !isDesktopFullScreen && (
        <MobileMiniPlayer 
          currentSong={currentSong}
          isPlaying={isPlaying}
          isLiked={isLiked}
          seek={seek}
          duration={duration}
          isControlDisabled={isColabLocked}
          onTogglePlay={handleTogglePlay}
          onNext={handleNextSong}
          onPrev={handlePrevSong}
          onLike={handleLike}
          onExpand={() => {
            if (!swipeDetected.current) {
                setIsExpanded(true);
            }
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
      )}


      <ProPurchaseModal 
        isOpen={isProModalOpen} 
        onClose={() => setProModalOpen(false)} 
      />

      <QueuePanel 
        isOpen={isQueueOpen} 
        onClose={handleCloseQueue} 
      />
    </>
  );
}

