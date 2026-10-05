"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Heart, ListPlus, PlusCircle, Music, Trash2, Download, Check } from 'lucide-react';
import { Song } from '@/lib/types';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleLike, checkIfLiked, getUserPlaylists, addToPlaylist } from '@/lib/ranking';
import { motion, AnimatePresence } from 'framer-motion';
import EventBus from '@/core/events/EventBus';
import { useUI } from '@/contexts/UIContext';
import { downloadSong, isDownloaded as checkIsDownloaded } from '@/lib/offlineStorage';
import { DownloadProgressBus } from '@/lib/downloadProgress';

interface SongListItemProps {
  song: Song;
  onPlay?: () => void;
  onLikeToggle?: () => void;
  onRemove?: (song: Song) => void;
  index: number;
}

export default function SongListItem({ song, onPlay, onLikeToggle, onRemove, index }: SongListItemProps) {
  const { currentSong, isPlaying, playSong, togglePlay, playNext, addToQueue } = usePlayer();
  const { user, isAdmin, isPro, login } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(-1); // -1 = not started, 0-100 = progress
  const { setProModalOpen, openAddToPlaylist } = useUI();
  
  const isCurrent = currentSong?.id === song.id;
  const isThisPlaying = isCurrent && isPlaying;

  useEffect(() => {
    if (user) {
      checkIfLiked(user.uid, song.id).then(setIsLiked);
    } else {
      setIsLiked(false);
    }

    // Live update listener
    const handleLikeUpdate = (data: any) => {
        if (data?.songId === song.id) {
            setIsLiked(data.isLiked);
        }
    };

    EventBus.on('likeStateChanged', handleLikeUpdate);
    return () => EventBus.off('likeStateChanged', handleLikeUpdate);
  }, [user, song.id]);

  useEffect(() => {
    if (song.id) {
       checkIsDownloaded(song.id).then(setIsDownloaded);
    }
  }, [song.id]);

  // Subscribe to download progress events for THIS song
  useEffect(() => {
    const onStart = () => { setDownloading(true); setDownloadPercent(0); };
    const onProgress = (data: any) => { setDownloadPercent(data.percent >= 0 ? data.percent : -1); };
    const onComplete = () => { setDownloading(false); setDownloadPercent(100); setIsDownloaded(true); };
    const onError = () => { setDownloading(false); setDownloadPercent(-1); };

    DownloadProgressBus.on(`download:start:${song.id}`, onStart);
    DownloadProgressBus.on(`download:progress:${song.id}`, onProgress);
    DownloadProgressBus.on(`download:complete:${song.id}`, onComplete);
    DownloadProgressBus.on(`download:error:${song.id}`, onError);

    return () => {
      DownloadProgressBus.off(`download:start:${song.id}`, onStart);
      DownloadProgressBus.off(`download:progress:${song.id}`, onProgress);
      DownloadProgressBus.off(`download:complete:${song.id}`, onComplete);
      DownloadProgressBus.off(`download:error:${song.id}`, onError);
    };
  }, [song.id]);


  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    try {
      await toggleLike(user.uid, song, isAdmin);
      EventBus.emit('likeChanged');
      if (onLikeToggle) onLikeToggle();
    } catch (error) {
      console.error("Like failed", error);
      setIsLiked(!newLiked);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    if (!isPro) {
      setProModalOpen(true);
      return;
    }
    if (downloading || isDownloaded) return;

    // Immediately show the animation — don't wait for downloadSong's internal emit
    setDownloading(true);
    setDownloadPercent(0);

    try {
      await downloadSong(song, user.email ?? undefined);
      // Bus will fire download:complete which sets isDownloaded=true and downloading=false
    } catch (error) {
       // Bus will fire download:error, but also handle the case where it didn't fire
       setDownloading(false);
       setDownloadPercent(-1);
       setErrorMsg('Download failed');
       setTimeout(() => setErrorMsg(''), 2000);
    }
    // NOTE: No finally { setDownloading(false) } — the Bus handles that
  };

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    playNext(song);
  };

  const handlePlaylistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    openAddToPlaylist(song);
  };

  const onDragEnd = async (_: any, info: any) => {
    const swipeThreshold = 70;
    if (info.offset.x > swipeThreshold) {
      addToQueue(song);
      setErrorMsg('Added to Queue');
      setTimeout(() => setErrorMsg(''), 2000);
    }
  };




  // Disable Framer Motion drag on touch devices to preserve native scrolling
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  return (
    <motion.div 
      drag={isTouchDevice ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.5 }}
      dragSnapToOrigin
      onDragEnd={onDragEnd}
      onClick={() => {
        if (isCurrent) {
          togglePlay();
        } else {
          if (onPlay) {
            onPlay();
          } else {
            playSong(song, 'standalone');
          }
        }
      }}
      className={`flex items-center gap-3 md:gap-4 px-4 py-2 md:px-6 md:py-2.5 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer border border-white/5 relative w-full ${isCurrent ? 'bg-purple-600/10 border-purple-500/20' : ''}`}
    >
      <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden shrink-0 shadow-lg bg-white/5">
        {song.image ? (
            <img 
                src={(() => {
                    const raw = Array.isArray(song.image) ? song.image[1] || song.image[0] : song.image;
                    return typeof raw === 'string' && raw.trim() !== '' ? raw : '/logo.png';
                })()} 
                onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.png';
                }}
                alt="" 
                className="w-full h-full object-cover" 
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center">
                <Music className="w-5 h-5 text-gray-500" />
            </div>
        )}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {isThisPlaying ? <Pause className="w-4 h-4 text-white fill-current" /> : <Play className="w-4 h-4 text-white fill-current ml-0.5" />}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className={`text-sm md:text-base font-semibold truncate ${isCurrent ? 'text-purple-400' : 'text-white'}`}>{song.name}</h4>
        <p className="text-xs text-gray-500 truncate">{song.artist}</p>
      </div>

      <div className="flex items-center gap-1 md:gap-3 opacity-100 transition-opacity">
        <button 
          onClick={handleLike}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-500 hover:text-white'}`} />
        </button>
        <button 
          onClick={handlePlayNext}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          title="Play Next"
        >
          <ListPlus className="w-4 h-4 text-gray-500 hover:text-white" />
        </button>

        <button 
          onClick={handleDownload}
          disabled={downloading || isDownloaded}
          className={`relative p-1.5 rounded-full transition-all duration-300 ${
            downloading 
              ? 'text-purple-400 scale-110' 
              : isDownloaded 
                ? 'text-green-500 bg-green-500/10' 
                : 'text-gray-500 hover:text-white hover:bg-white/10'
          }`}
          title={isPro ? (isDownloaded ? "Downloaded" : downloading ? `Downloading ${downloadPercent >= 0 ? downloadPercent + '%' : '...'}` : "Download") : "Go Pro to Download"}
        >
          {downloading ? (
            <div className="relative w-7 h-7 flex items-center justify-center">
              {/* Circular progress ring */}
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-15" />
                {/* Progress arc */}
                <circle 
                  cx="18" cy="18" r="15" fill="none" 
                  stroke="url(#dlGrad)" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeDasharray="94.25" 
                  strokeDashoffset={downloadPercent >= 0 ? 94.25 - (94.25 * downloadPercent / 100) : 70}
                  className={downloadPercent < 0 ? 'animate-spin origin-center' : 'transition-all duration-300'}
                />
                <defs>
                  <linearGradient id="dlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Center text */}
              {downloadPercent >= 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-purple-300">
                  {downloadPercent}%
                </span>
              )}
            </div>
          ) : isDownloaded ? (
            <div className="w-7 h-7 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
          )}
        </button>

        {onRemove && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove(song);
            }}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group/trash"
            title="Remove from Playlist"
          >
            <Trash2 className="w-4 h-4 text-gray-500 group-hover/trash:text-red-500 transition-colors" />
          </button>
        )}

        <div className="relative">
          <button 
            onClick={handlePlaylistClick}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Add to Playlist"
          >
            <PlusCircle className="w-4 h-4 text-gray-500 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 text-white text-xs font-semibold rounded-full shadow-2xl flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

