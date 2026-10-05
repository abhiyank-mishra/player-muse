"use client";
import React, { useState, useEffect } from 'react';
import { Play, Pause, Heart, Pin, PinOff, ListPlus, PlusCircle, Download, Check } from 'lucide-react';
import { Song } from '@/lib/types';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleLike, checkIfLiked, toggleGlobalPin, isPinnedToGlobal, getUserPlaylists, addToPlaylist } from '@/lib/ranking';
import { motion, AnimatePresence } from 'framer-motion';
import EventBus from '@/core/events/EventBus';
import Spinner from '@/reusable/animations/loading/Spinner';
import { useUI } from '@/contexts/UIContext';
import { downloadSong, isDownloaded as checkIsDownloaded } from '@/lib/offlineStorage';
import { DownloadProgressBus } from '@/lib/downloadProgress';

interface SongCardProps {
  song: Song;
  onPlay?: () => void;
  onLikeToggle?: () => void;
}

export default function SongCard({ song, onPlay, onLikeToggle }: SongCardProps) {
  const { currentSong, isPlaying, playSong, togglePlay, playNext, addToQueue } = usePlayer();
  const { user, isAdmin, isPro, login } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(-1);
  const { setProModalOpen } = useUI();
  
  const isCurrent = currentSong?.id === song.id;
  const isThisPlaying = isCurrent && isPlaying;

  useEffect(() => {
    if (user) {
      checkIfLiked(user.uid, song.id).then(setIsLiked);
      if (isAdmin) {
          isPinnedToGlobal(song.id).then(setIsPinned);
      }
    } else {
      setIsLiked(false);
      setIsPinned(false);
    }

    // Live update listener
    const handleLikeUpdate = (data: any) => {
        if (data?.songId === song.id) {
            setIsLiked(data.isLiked);
        }
    };

    EventBus.on('likeStateChanged', handleLikeUpdate);
    return () => EventBus.off('likeStateChanged', handleLikeUpdate);
  }, [user, isAdmin, song.id]);

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

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    try {
        await toggleGlobalPin(song);
    } catch (e) {
        setIsPinned(!newPinned);
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

    // Immediately show animation
    setDownloading(true);
    setDownloadPercent(0);

    try {
      await downloadSong(song, user.email ?? undefined);
      // Bus will fire download:complete which sets isDownloaded=true
    } catch (error) {
       setDownloading(false);
       setDownloadPercent(-1);
       setErrorMsg('Download failed');
       setTimeout(() => setErrorMsg(''), 2000);
    }
  };

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    playNext(song);
  };

  const handlePlaylistClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    setShowPlaylists(!showPlaylists);
    if (!showPlaylists) {
      const data = await getUserPlaylists(user.uid, isPro);
      setPlaylists(data);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingToId(playlistId);
    try {
      // Check if playlist already has 50 songs
      const playlist = playlists.find(p => p.id === playlistId);
      if (playlist && playlist.songs && playlist.songs.length >= 50) {
        setErrorMsg('Playlist is full (Max 50 songs)');
        setTimeout(() => setErrorMsg(''), 3000);
        setAddingToId(null);
        return;
      }
      await addToPlaylist(user!.uid, playlistId, song);
      setShowPlaylists(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingToId(null);
    }
  };

  const onDragEnd = async (_: any, info: any) => {
    const swipeThreshold = 80;
    if (info.offset.x > swipeThreshold) {
      addToQueue(song);
      setErrorMsg('Added to Queue');
      setTimeout(() => setErrorMsg(''), 2000);
    }
  };

  // Disable Framer Motion drag on touch devices to preserve native horizontal scrolling
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
        } else if (onPlay) {
          onPlay();
        } else {
          playSong(song, 'standalone');
        }
      }}
      className={`group relative flex flex-col gap-2 p-2 sm:p-2.5 pb-2.5 sm:pb-3 rounded-2xl bg-[#141416]/90 hover:bg-[#1f1f23] transition-all duration-300 border ${
        isThisPlaying 
          ? 'border-purple-500/40 shadow-lg shadow-purple-500/10' 
          : 'border-white/[0.06] hover:border-white/[0.12] shadow-md hover:shadow-xl'
      } cursor-pointer hover:-translate-y-1`}
    >
      <div className="relative aspect-square rounded-xl shadow-lg bg-[#0a0a0a] overflow-hidden">
        <img 
          src={(() => {
            const raw = Array.isArray(song.image) ? (song.image[2] || song.image[0]) : song.image;
            return typeof raw === 'string' && raw.trim() !== '' ? raw : '/logo.png';
          })()}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/logo.png';
          }}
          alt={song.name} 
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* YouTube Source Badge */}
        {(song.source === 'youtube' || song.type === 'youtube') && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-600/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider rounded shadow z-20">
            YouTube
          </div>
        )}

        {/* Like Button on Image - Top Right Corner ONLY, No Circular BG */}
        <button 
          onClick={handleLike}
          className="absolute top-1.5 right-1.5 p-1 transition-transform duration-200 hover:scale-125 z-20"
          title={isLiked ? "Unlike" : "Like"}
        >
          <Heart 
            className={`w-4 h-4 transition-all duration-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
              isLiked 
                ? 'fill-rose-500 text-rose-500 scale-105' 
                : 'text-white/80 opacity-0 group-hover:opacity-100 hover:text-white'
            }`} 
          />
        </button>

        {/* Live Playing Soundwave Indicator in Bottom Corner */}
        {isThisPlaying && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-1 bg-black/60 backdrop-blur-md rounded-md flex items-end gap-0.5 h-3.5 z-20 shadow-md">
            <span className="w-0.5 h-full bg-purple-400 rounded-full animate-[bounce_0.8s_infinite]" />
            <span className="w-0.5 h-2 bg-purple-400 rounded-full animate-[bounce_0.6s_infinite_0.2s]" />
            <span className="w-0.5 h-1.5 bg-purple-400 rounded-full animate-[bounce_0.7s_infinite_0.4s]" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 min-w-0 px-0.5">
        <h3 
          className={`font-semibold text-xs sm:text-sm truncate leading-snug transition-colors ${
            isThisPlaying ? 'text-purple-400' : 'text-zinc-100 group-hover:text-white'
          }`} 
          title={song.name}
        >
          {song.name}
        </h3>
        
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p 
            className="text-[11px] sm:text-xs text-zinc-400 truncate hover:text-zinc-200 transition-colors flex-1"
            title={song.artist}
          >
            {song.artist}
          </p>
          
          <button 
            onClick={handlePlaylistClick}
            className="p-1 -mr-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors shrink-0"
            title="Add to Playlist"
          >
            <ListPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Playlist Popover */}
      <AnimatePresence>
        {showPlaylists && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={(e) => { e.stopPropagation(); setShowPlaylists(false); }} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 6 }}
              className="absolute bottom-10 right-0 min-w-[13rem] bg-[#18181b]/98 backdrop-blur-xl border border-white/15 p-2.5 rounded-xl shadow-2xl z-50 flex flex-col gap-1"
              style={{ maxWidth: '90vw' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1">Save to Playlist</p>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                {playlists.length > 0 ? (
                  playlists.map(p => (
                    <button 
                      key={p.id}
                      disabled={addingToId === p.id}
                      onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(p.id); }}
                      className="flex items-center justify-between w-full p-2 rounded-lg text-left text-xs font-medium hover:bg-white/10 transition-all text-gray-200 hover:text-white disabled:opacity-50"
                    >
                      <span className="truncate">{p.name}</span>
                      {addingToId === p.id ? <Spinner className="w-3 h-3" /> : <PlusCircle className="w-3 h-3 text-purple-400 shrink-0" />}
                    </button>
                  ))
                ) : (
                  <p className="text-[10px] text-gray-500 italic px-2 py-3 text-center">No playlists found. <br/> Create one in Sidebar!</p>
                )}
              </div>
              
              {/* Quick actions: Play Next, Download, Admin Pin */}
              <div className="pt-1.5 mt-1 border-t border-white/10 flex items-center justify-between gap-1 px-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePlayNext(e); setShowPlaylists(false); }}
                  className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white py-1 px-1.5 rounded hover:bg-white/10 transition-colors"
                  title="Play Next in Queue"
                >
                  <ListPlus className="w-3 h-3 text-purple-400" /> Next
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDownload(e); }}
                  disabled={downloading || isDownloaded}
                  className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white py-1 px-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
                  title={isDownloaded ? "Already Downloaded" : "Download Song"}
                >
                  {isDownloaded ? <Check className="w-3 h-3 text-green-400" /> : <Download className="w-3 h-3 text-purple-400" />}
                  {isDownloaded ? 'Saved' : downloading ? `${downloadPercent >= 0 ? downloadPercent + '%' : '...'}` : 'Download'}
                </button>
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePin(e); }}
                    className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white py-1 px-1.5 rounded hover:bg-white/10 transition-colors"
                    title="Pin to Global Top"
                  >
                    {isPinned ? <Pin className="w-3 h-3 text-purple-400 fill-purple-400" /> : <PinOff className="w-3 h-3 text-zinc-400" />}
                    Pin
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

