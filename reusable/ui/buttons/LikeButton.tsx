"use client";

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Song } from '@/lib/types';
import { toggleLike, checkIfLiked } from '@/lib/ranking';
import EventBus from '@/core/events/EventBus';

interface LikeButtonProps {
    song: Song;
    user: any;
    className?: string;
    iconClassName?: string;
}

export default function LikeButton({ song, user, className, iconClassName }: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (user && song) {
      checkIfLiked(user.uid, song.id).then(setIsLiked);
    } else {
        setTimeout(() => setIsLiked(false), 0);
    }

    // Live update listener
    const handleLikeUpdate = (data: any) => {
        if (data?.songId === song.id) {
            setIsLiked(data.isLiked);
        }
    };

    EventBus.on('likeStateChanged', handleLikeUpdate);
    return () => EventBus.off('likeStateChanged', handleLikeUpdate);
  }, [user, song]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return showToast('Please login to like songs', 'info');
    const newState = !isLiked;
    setIsLiked(newState);
    try {
        await toggleLike(user.uid, song, false);
    } catch (e) {
        setIsLiked(!newState);
    }
  };

  return (
    <button 
        onClick={handleLike}
        className={className || "p-4 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors"}
    >
        <Heart className={`${iconClassName || 'w-8 h-8'} ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
    </button>
  );
}
