"use client";

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Song } from '@/lib/types';
import SongListItem from '@/components/SongListItem';
import { ChevronLeft, Play, Shuffle, Music2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Footer from '@/components/Footer';
import { useToast } from '@/contexts/ToastContext';
// downloadSong replaced by downloadPlaylistForOffline (imported dynamically)
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/reusable/animations/loading/Spinner';
import BackNavigation from '@/reusable/ui/navigation/BackNavigation';
import { useUI } from '@/contexts/UIContext';
import ProPurchaseModal from '@/reusable/ui/modals/ProPurchaseModal';

interface UniversalPlaylistViewProps {
  title: string;
  subtitle: string;
  image?: string;
  description?: string;
  songs: Song[];
  isPlaying?: boolean;
  currentSong?: Song | null;
  onPlay: (song: Song, index: number) => void;
  onPlayAll: (shuffle: boolean, shuffledSongs?: Song[]) => void;
  loading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  type?: 'playlist' | 'album' | 'favorites';
  stats?: React.ReactNode;
  onRemove?: (song: Song) => void;
  playlistId?: string;
}

export default function UniversalPlaylistView({
  title,
  subtitle,
  image,
  description,
  songs,
  onPlay,
  onPlayAll,
  loading,
  onLoadMore,
  hasMore,
  loadingMore,
  type = 'playlist',
  stats,
  onRemove,
  playlistId
}: UniversalPlaylistViewProps) {
  const router = useRouter();
  const observer = useRef<IntersectionObserver | null>(null);
  const [backLabel, setBackLabel] = useState("Back");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      if (referrer.includes(window.location.host)) {
        const path = new URL(referrer).pathname;
        if (path === '/') setBackLabel('Back to Home');
        else if (path.startsWith('/search')) setBackLabel('Back to Search');
        else if (path.startsWith('/explore')) setBackLabel('Back to Explore');
        else if (path.startsWith('/favorites')) setBackLabel('Back to Favorites');
        else if (path.startsWith('/downloads')) setBackLabel('Back to Downloads');
        else if (path.startsWith('/my-playlist')) setBackLabel('Back to Playlists');
      } else {
        setBackLabel('Back to Explore');
      }
    }
  }, []);

  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handlePlayAll = (shuffle: boolean) => {
    if (shuffle) {
      // Actually shuffle the songs before playing
      const shuffledSongs = shuffleArray(songs);
      onPlayAll(true, shuffledSongs);
    } else {
      onPlayAll(false);
    }
  };

  const { showToast } = useToast();
  const { user, isPro } = useAuth();
  const { isProModalOpen, setProModalOpen } = useUI();
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [dlProgress, setDlProgress] = useState({ completed: 0, total: 0 });

  // Reconnect to active downloads on mount (background downloads survive navigation)
  useEffect(() => {
    const stableId = playlistId || title.toLowerCase().replace(/\s+/g, '-');
    // Dynamic import to avoid circular deps
    import('@/lib/downloadManager').then(({ getActiveDownload }) => {
      const active = getActiveDownload(stableId);
      if (active && active.isDownloading) {
        setDownloadingAll(true);
        setDlProgress({ completed: active.completed, total: active.total });
      }
    });
  }, [playlistId, title]);

  // Subscribe to Bus for live playlist progress (works even after re-mount)
  useEffect(() => {
    const stableId = playlistId || title.toLowerCase().replace(/\s+/g, '-');
    const { DownloadProgressBus } = require('@/lib/downloadProgress');

    const handlePlaylistProgress = (data: any) => {
      if (data.playlistId !== stableId) return;
      setDlProgress({ completed: data.completed, total: data.total });

      if (!data.isDownloading && !data.error) {
        setDownloadingAll(false);
        showToast(`All ${data.completed} songs downloaded!`);
      } else if (data.error) {
        setDownloadingAll(false);
        showToast(data.error, 'error');
      } else {
        setDownloadingAll(true);
      }
    };

    DownloadProgressBus.on('download:playlist:progress', handlePlaylistProgress);
    return () => DownloadProgressBus.off('download:playlist:progress', handlePlaylistProgress);
  }, [playlistId, title, showToast]);

  const handleDownloadAllSongs = async () => {
      if (downloadingAll || songs.length === 0) return;
      
      setDownloadingAll(true);
      setDlProgress({ completed: 0, total: songs.length });

      // Build a playlist-like object for the manager
      const stableId = playlistId || title.toLowerCase().replace(/\s+/g, '-');
      const playlistObj = {
        id: stableId,
        name: title,
        description: subtitle || '',
        coverImage: image || '',
        songs: songs,
      };

      // Fire-and-forget — download continues in background even if component unmounts
      import('@/lib/downloadManager').then(({ downloadPlaylistForOffline }) => {
        downloadPlaylistForOffline(playlistObj as any, user?.email ?? '').catch((e: any) => {
          console.error('Playlist download failed:', e);
        });
      });
  };

  const lastSongRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && onLoadMore) {
        onLoadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, onLoadMore]);

  return (
    <div className="min-h-screen pb-32">
      {/* Header Section */}
      <div className="relative pt-4 pb-6 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="flex items-center justify-between mb-6 z-20 relative">
          <BackNavigation 
            label={backLabel} 
            onClick={() => router.back()} 
          />
        </div>

        <div className="flex flex-col items-start md:flex-row md:items-end gap-6 md:gap-8 transition-all">
          {/* Cover Image - Smaller and Aligned Left/Down */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-44 h-44 md:w-60 md:h-60 rounded-2xl overflow-hidden shadow-2xl shrink-0 bg-[#282828] relative group mt-4 ml-2"
          >
            {typeof image === 'string' && image.trim() !== '' ? (
              <img src={image} className="w-full h-full object-cover shadow-[0_8px_40px_rgba(0,0,0,0.5)]" alt={title} />
            ) : loading ? (
              <div className="w-full h-full bg-white/5 animate-pulse flex items-center justify-center">
                <Music2 className="w-16 h-16 text-white/10 animate-pulse" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-blue-900/40">
                <Music2 className="w-16 h-16 text-white/20" />
              </div>
            )}
          </motion.div>

          {/* Info - Aligned Left */}
          <div className="flex-1 flex flex-col items-start text-left z-10 w-full px-2">
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2"
            >
              {subtitle || "PLAYLIST"}
            </motion.p>
            
            {loading && (!title || title === "Featured Chart") ? (
              <div className="w-64 md:w-96 h-10 md:h-14 bg-white/10 rounded-xl animate-pulse mb-6" />
            ) : (
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-3xl md:text-5xl lg:text-7xl font-black text-white mb-6 tracking-tight leading-tight"
              >
                {title}
              </motion.h1>
            )}

            {/* Action Buttons - Smaller Text/Height */}
            <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
               <button 
                 onClick={() => handlePlayAll(false)}
                 disabled={loading || songs.length === 0}
                 className={`flex-1 md:flex-none h-10 md:h-12 px-4 md:px-6 rounded-full bg-white text-black font-bold text-xs md:text-base flex items-center justify-center gap-1.5 md:gap-2 transition-transform active:scale-95 shadow-xl whitespace-nowrap ${
                   loading || songs.length === 0 ? 'opacity-40 pointer-events-none' : 'hover:scale-105'
                 }`}
               >
                 <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                 Play Now
               </button>
               
               <button 
                 onClick={() => handlePlayAll(true)}
                 disabled={loading || songs.length === 0}
                 className={`flex-1 md:flex-none h-10 md:h-12 px-4 md:px-6 rounded-full bg-white/10 text-white font-bold text-xs md:text-base flex items-center justify-center gap-1.5 md:gap-2 transition-colors active:scale-95 border border-white/5 whitespace-nowrap ${
                   loading || songs.length === 0 ? 'opacity-40 pointer-events-none' : 'hover:bg-white/20'
                 }`}
               >
                 <Shuffle className="w-4 h-4 md:w-5 md:h-5" />
                 Shuffle
               </button>

               {/* Download All / Go Pro Button */}
               {isPro ? (
                  <button 
                    onClick={handleDownloadAllSongs}
                    disabled={downloadingAll || loading || songs.length === 0}
                    className={`flex-none h-10 md:h-12 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5 ${
                      loading || songs.length === 0
                        ? 'w-10 md:w-12 bg-white/5 text-white/30 pointer-events-none'
                        : downloadingAll 
                          ? 'px-4 md:px-5 bg-purple-600/30 text-purple-300 border-purple-500/30' 
                          : 'w-10 md:w-12 bg-white/10 text-white hover:bg-white/20'
                    }`}
                    title={downloadingAll ? `Downloading ${dlProgress.completed}/${dlProgress.total}` : 'Download All'}
                  >
                    {downloadingAll ? (
                       <>
                         <svg className="w-5 h-5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                         </svg>
                         <span className="text-xs font-bold whitespace-nowrap">{dlProgress.completed}/{dlProgress.total}</span>
                       </>
                    ) : (
                       <Download className="w-5 h-5" />
                    )}
                  </button>
               ) : (
                  <button 
                    onClick={() => setProModalOpen(true)}
                    className="flex-1 md:flex-none h-10 md:h-12 px-4 md:px-6 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 md:w-5 md:h-5" />
                    Go Pro
                  </button>
               )}
            </div>
          </div>
        </div>
      </div>

      <ProPurchaseModal 
        isOpen={isProModalOpen} 
        onClose={() => setProModalOpen(false)} 
      />

      {/* Songs List */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
        <div className="flex flex-col">
          {loading && songs.length === 0 ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div 
                  key={`skeleton-${idx}`} 
                  className="flex items-center gap-3 md:gap-4 py-2.5 px-3 md:px-4 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse"
                >
                  <div className="w-4 h-4 bg-white/10 rounded shrink-0 hidden md:block" />
                  <div className="w-11 h-11 md:w-12 md:h-12 bg-white/10 rounded-lg shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <div className="w-48 max-w-[65%] h-3.5 bg-white/15 rounded-md" />
                    <div className="w-28 max-w-[40%] h-2.5 bg-white/10 rounded-md" />
                  </div>
                  <div className="w-24 h-3 bg-white/5 rounded-md hidden md:block" />
                  <div className="w-10 h-3 bg-white/10 rounded-md shrink-0" />
                </div>
              ))}
            </div>
          ) : songs.length > 0 ? (
            songs.map((song, index) => (
              <div key={`${song.id}-${index}`} ref={index === songs.length - 1 ? lastSongRef : null}>
                <SongListItem 
                  song={song} 
                  index={index} 
                  onPlay={() => onPlay(song, index)}
                  onRemove={onRemove ? (s) => onRemove(s) : undefined}
                />
              </div>
            ))
          ) : (
             <div className="py-20 flex flex-col items-center justify-center text-gray-500">
                <Music2 className="w-16 h-16 mb-4 opacity-50" />
                <p>No songs added yet.</p>
             </div>
          )}
          
          {loadingMore && (
            <div className="py-4 flex justify-center">
              <Spinner className="w-6 h-6  text-purple-500" />
            </div>
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
