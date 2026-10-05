"use client";
import React, { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useRouter } from 'next/navigation';
import { Song } from '@/lib/types';
import UniversalPlaylistView from '@/components/UniversalPlaylistView';

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const { setQueueConfig } = usePlayer();
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const { id } = use(params);

  useEffect(() => {
    loadArtist();
  }, [id]);

  const loadArtist = async () => {
    try {
        const res = await fetch(`/api/music/artist?id=${id}`);
        if(res.ok) {
            const data = await res.json();
            setArtist(data);
        } else {
            console.error('Failed to load artist');
        }
    } catch (error) {
      console.error('Failed to load artist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (song: Song, index: number) => {
    if (!artist || !artist.songs || artist.songs.length === 0) return;
    setQueueConfig(artist.songs, index);
  }

  const handlePlayAll = (shuffle: boolean, shuffledSongs?: Song[]) => {
    if (!artist || !artist.songs || artist.songs.length === 0) return;
    const songsToPlay = shuffledSongs || artist.songs;
    setQueueConfig(songsToPlay, 0);
  }

  const handleBack = () => router.back();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <h2 className="text-2xl font-bold mb-4">Artist Not Found</h2>
        <button onClick={handleBack} className="px-6 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <UniversalPlaylistView
      title={artist.name}
      subtitle={artist.subtitle || 'Artist'}
      image={artist.image}
      songs={artist.songs || []}
      loading={loading}
      onPlay={handlePlay}
      onPlayAll={handlePlayAll}
      type="playlist"
      playlistId={id}
    />
  );
}
