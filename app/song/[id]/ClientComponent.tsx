"use client";

import React, { useEffect, useRef } from 'react';
import Home from '../../page'; 
import { usePlayer } from '@/contexts/PlayerContext';
import { Song } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

export default function SongPageClient({ song }: { song: Song | null }) {
  const { playSong, currentSong } = usePlayer();
  const { user, loading: authLoading } = useAuth();
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    // Wait for auth to load before attempting to play
    // This prevents "guest limit" redirect for logged-in users
    if (authLoading) return;

    // Only play if we have a song and haven't triggered it yet
    if (song && !hasPlayedRef.current) {
        // Prevent re-playing if the song is already the current one (to avoid restart on re-renders)
        if (currentSong?.id !== song.id) {
            playSong(song);
        }
        hasPlayedRef.current = true;
    }
  }, [song, playSong, currentSong, authLoading]);

  return <Home />;
}
