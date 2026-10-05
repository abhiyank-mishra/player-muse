"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Song } from '@/lib/types';
import SwipeableSongItem from './SwipeableSongItem';
import Spinner from '@/reusable/animations/loading/Spinner';

interface SongListProps {
    songs: Song[];
    currentSong?: Song | null;
    isPlaying: boolean;
    onPlay: (index: number) => void;
    onSwipeRight?: (song: Song) => void; // Add to queue
    onDelete?: (song: Song) => void;
    
    // Scroll Behavior
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onLoadMore?: () => void;
    useInfiniteScroll?: boolean; // Default true. Set false for Home screen "Load More" button.
}

export default function SongList({
    songs,
    currentSong,
    isPlaying,
    onPlay,
    onSwipeRight,
    onDelete,
    hasMore = false,
    isLoadingMore = false,
    onLoadMore,
    useInfiniteScroll = true
}: SongListProps) {
    const observerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!useInfiniteScroll || !onLoadMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
                    onLoadMore();
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
        );

        if (observerRef.current) observer.observe(observerRef.current);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, onLoadMore, useInfiniteScroll]);

    if (songs.length === 0 && !isLoadingMore) {
        return (
            <div className="text-center py-12 text-gray-500">
                No songs available.
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="space-y-0.5">
                {songs.map((song, index) => (
                    <SwipeableSongItem
                        key={`${song.id}-${index}`}
                        song={song}
                        index={index}
                        isCurrent={currentSong?.id === song.id}
                        isPlaying={isPlaying}
                        onPlay={() => onPlay(index)}
                        onSwipeRight={onSwipeRight ? () => onSwipeRight(song) : undefined}
                        onDelete={onDelete ? () => onDelete(song) : undefined}
                    />
                ))}
            </div>

            {/* Loading / Load More Section */}
            {hasMore && (
                <div ref={observerRef} className="py-6 flex justify-center">
                    {isLoadingMore ? (
                        <Spinner size="md" color="text-purple-500" />
                    ) : (
                        !useInfiniteScroll && onLoadMore && (
                            <button 
                                onClick={onLoadMore}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-semibold transition-colors"
                            >
                                Load More Songs
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
