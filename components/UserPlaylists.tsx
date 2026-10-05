"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPlaylists } from '@/lib/ranking';
import { Music, Play, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { userPlaylistsCache } from '@/lib/userPlaylistsCache';
import { usePlayer } from '@/contexts/PlayerContext';

export default function UserPlaylists() {
  const { user, isPro } = useAuth();
  const router = useRouter();
  const { setQueueConfig } = usePlayer();

  // Instant hydration from cache — 0ms render
  const initialPlaylists = userPlaylistsCache.get(user?.uid);
  const [playlists, setPlaylists] = useState<any[]>(() => initialPlaylists || []);
  const [loading, setLoading] = useState(() => !initialPlaylists);

  useEffect(() => {
    if (user) {
      loadPlaylists();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadPlaylists = async (force = false) => {
    const cached = userPlaylistsCache.get(user?.uid) || userPlaylistsCache.restoreFromStorage(user?.uid);
    if (!force && cached && cached.length > 0) {
      setPlaylists(cached);
      setLoading(false);
      return;
    }

    try {
      const data = await getUserPlaylists(user!.uid, isPro);
      if (Array.isArray(data)) {
        setPlaylists(data);
        userPlaylistsCache.set(user!.uid, data);
      }
    } catch (error) {
      console.error('Failed to load playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPlay = (e: React.MouseEvent, playlist: any) => {
    e.stopPropagation();
    if (playlist.songs && playlist.songs.length > 0) {
      setQueueConfig(playlist.songs, 0);
    } else {
      navigateToPlaylist(playlist);
    }
  };

  const navigateToPlaylist = (playlist: any) => {
    const cover = playlist.songs?.[0]?.image 
      ? (Array.isArray(playlist.songs[0].image) ? playlist.songs[0].image[2] || playlist.songs[0].image[0] : playlist.songs[0].image) 
      : '';
    router.push(`/my-playlist/${playlist.id}?name=${encodeURIComponent(playlist.name)}&tracks=${playlist.songs?.length || 0}&cover=${encodeURIComponent(cover || '')}`);
  };

  if (!user) return null;

  return (
    <section className="mb-0">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-3">
        
        {/* Liked Songs Card - Modern Radiant Gradient */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push(`/favorites`)}
          className="group relative flex items-center gap-3 p-1.5 rounded-xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-zinc-900/40 hover:from-purple-900/50 hover:via-indigo-900/30 hover:to-zinc-800/60 border border-purple-500/20 hover:border-purple-500/40 backdrop-blur-md cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-purple-500/10 overflow-hidden"
        >
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 via-indigo-600 to-pink-500 shrink-0 shadow-md shadow-purple-500/20">
            <Heart className="w-5 h-5 md:w-6 md:h-6 text-white fill-white drop-shadow" />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-xs md:text-sm font-bold text-white truncate tracking-tight">Liked Songs</h3>
            <p className="text-[10px] md:text-xs text-purple-300/80 truncate">Auto Playlist</p>
          </div>
          {/* Quick Play Button */}
          <div className="opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-purple-500 hover:bg-purple-400 text-white shadow-lg transition-all mr-1.5 shrink-0 translate-x-1 group-hover:translate-x-0">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </motion.div>

        {/* User Playlists */}
        {playlists.map((playlist) => {
          const firstSongImg = playlist.songs?.[0]?.image 
            ? (Array.isArray(playlist.songs[0].image) ? playlist.songs[0].image[2] || playlist.songs[0].image[0] : playlist.songs[0].image) 
            : undefined;

          return (
            <motion.div
              key={playlist.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigateToPlaylist(playlist)}
              className="group relative flex items-center gap-3 p-1.5 rounded-xl bg-[#141416]/90 hover:bg-[#1f1f24] border border-white/[0.06] hover:border-white/[0.14] backdrop-blur-md cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 overflow-hidden"
            >
              {/* Cover Image Thumbnail */}
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-900 shadow-md relative">
                {firstSongImg && typeof firstSongImg === 'string' && firstSongImg.trim() !== '' ? (
                  <img 
                    src={firstSongImg} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/logo.png';
                    }}
                    alt={playlist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-zinc-900">
                    <Music className="w-5 h-5 text-zinc-500" />
                  </div>
                )}
              </div>

              {/* Playlist Info */}
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-xs md:text-sm font-semibold text-zinc-100 group-hover:text-white truncate transition-colors" title={playlist.name}>
                  {playlist.name}
                </h3>
                <p className="text-[10px] md:text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors truncate mt-0.5">
                  {playlist.songs?.length || 0} {playlist.songs?.length === 1 ? 'track' : 'tracks'}
                </p>
              </div>
              
              {/* Quick Play Button Overlay */}
              {playlist.songs?.length > 0 && (
                <button
                  onClick={(e) => handleQuickPlay(e, playlist)}
                  className="opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-purple-500 hover:bg-purple-400 text-white shadow-lg transition-all mr-1.5 shrink-0 translate-x-1 group-hover:translate-x-0"
                  title="Play Playlist"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
