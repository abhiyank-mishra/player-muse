"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
// @ts-ignore
import { Howler } from 'howler';
import { useExploreSongs } from './hooks/useExploreSongs';

export function useExploreLogic() {
  const { songs: uniqueSongs, loading, error, loadMore } = useExploreSongs();
  const [isReady, setIsReady] = useState(false);
  
  const { setQueueConfig, currentSong, isPlaying, seek, duration, togglePlay } = usePlayer();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (Howler && Howler.ctx && Howler.ctx.state === 'running') {
        setTimeout(() => setIsReady(true), 0);
    } else if (!Howler || !Howler.ctx) {
        setTimeout(() => setIsReady(true), 0);
    }
  }, []);

  const handleStartExplorer = () => {
    if (Howler && Howler.ctx) {
        if (Howler.ctx.state !== 'running') {
            Howler.ctx.resume().then(() => setIsReady(true));
        } else {
            setIsReady(true);
        }
    } else {
        setIsReady(true);
    }
  };

  const lastScrolledSongId = useRef<string | null>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    if (!isReady || uniqueSongs.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        if (isScrollingRef.current) return;

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const songId = entry.target.getAttribute('data-song-id');
                const song = uniqueSongs.find(s => s.id === songId);
                const index = uniqueSongs.findIndex(s => s.id === songId);
                
                if (song && song.id !== currentSong?.id) {
                    lastScrolledSongId.current = song.id; 
                    setQueueConfig(uniqueSongs, index);
                }

                if (index >= uniqueSongs.length - 3) {
                     loadMore();
                }
            }
        });
    }, { threshold: 0.6 });

    const elements = document.querySelectorAll('.snap-start');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [uniqueSongs, setQueueConfig, currentSong, isReady, loadMore]);

  useEffect(() => {
      if (currentSong && uniqueSongs.length > 0 && containerRef.current) {
         if (lastScrolledSongId.current === currentSong.id) return;

         const index = uniqueSongs.findIndex(s => s.id === currentSong.id);
         if (index !== -1) {
             const targetTop = window.innerHeight * index;
             
             if (Math.abs(containerRef.current.scrollTop - targetTop) > 50) {
                 isScrollingRef.current = true;
                 lastScrolledSongId.current = currentSong.id; 

                 containerRef.current.scrollTo({
                     top: targetTop,
                     behavior: 'smooth'
                 });
                 
                 setTimeout(() => {
                     isScrollingRef.current = false;
                 }, 800);
             }
         }
      }
  }, [currentSong, uniqueSongs]);

  const handleBack = () => {
      router.push('/');
  }

  return {
    state: { songs: uniqueSongs, loading, error, isReady, currentSong, user },
    actions: { handleStartExplorer, handleBack, loadMore, togglePlay, setQueueConfig, containerRef }
  };
}
