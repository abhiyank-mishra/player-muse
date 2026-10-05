"use client";
import React, { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useRouter } from 'next/navigation';
import { Song } from '@/lib/types';
import UniversalPlaylistView from '@/components/UniversalPlaylistView';
import { getCuratedPlaylist } from '@/lib/curatedPlaylists';

export default function CuratedPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const { setQueueConfig, toggleShuffle } = usePlayer();
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const { id } = use(params);

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  const loadPlaylist = async () => {
    try {
        const data = await getCuratedPlaylist(id);
        if(data) {
            setPlaylist(data);
        } else {
            // Try to fetch via API if lib fails (fallback)
            const searchParams = new URLSearchParams(window.location.search);
            const type = searchParams.get('type') || 'playlist';
            
            const res = await fetch(`/api/music/playlist?id=${id}&type=${type}`);
            if (res.ok) {
                const saavnData = await res.json();
                if (saavnData && saavnData.songs) {
                    setPlaylist({
                        id: saavnData.id,
                        name: saavnData.name || "Mix",
                        coverImage: saavnData.image,
                        description: saavnData.description,
                        songs: saavnData.songs
                    });
                }
            }
        }
    } catch (error) {
      console.error('Failed to load playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (song: Song, index: number) => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
    setQueueConfig(playlist.songs, index);
  }

  const handlePlayAll = (shuffle: boolean, shuffledSongs?: Song[]) => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
    const songsToPlay = shuffledSongs || playlist.songs;
    setQueueConfig(songsToPlay, 0);
  };

  if(!playlist && loading) return null;

  return (
    <UniversalPlaylistView 
        title={playlist?.name || "Mix"}
        subtitle={playlist?.description ? "Playlist" : "Curated Playlist"}
        image={playlist?.coverImage}
        description={playlist?.description}
        songs={playlist?.songs || []}
        loading={loading}
        onPlay={handlePlay}
        onPlayAll={handlePlayAll}
        hasMore={false}
        playlistId={id}
    />
  );
}
