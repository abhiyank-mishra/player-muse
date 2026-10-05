import { usePlayer } from '@/contexts/PlayerContext';
import { Song } from '@/lib/types';
import { useCallback } from 'react';

export function usePlayerControls() {
    const { 
        currentSong, 
        isPlaying, 
        togglePlay, 
        nextSong, 
        prevSong, 
        toggleShuffle, 
        toggleRepeat,
        seekTo, // Function
        isBuffering,
        isShuffle, // Value
        repeatMode,
        seek: currentSeekTime, // Value (renamed to avoid conflict)
        duration,
        queue,
        currentIndex,
        setQueueConfig
    } = usePlayer();

    // Wrapper to play a list of songs (e.g., from a playlist or album)
    const playList = useCallback((songs: Song[], startIndex: number = 0) => {
        if (songs.length > 0) {
           setQueueConfig(songs, startIndex);
        }
    }, [setQueueConfig]);

    return {
        currentSong,
        isPlaying,
        isBuffering,
        isShuffle,
        repeatMode,
        currentTime: currentSeekTime,
        duration,
        play: togglePlay, 
        pause: togglePlay,
        togglePlay,
        playNext: nextSong,      // Expose 'nextSong' as 'playNext' (Skip)
        playPrevious: prevSong,  // Expose 'prevSong' as 'playPrevious' (Skip)
        seek: seekTo,            // Expose 'seekTo' as 'seek' (Function)
        toggleShuffle,
        toggleRepeat,
        playList,
        queue,
        hasPrevious: currentIndex > 0 || repeatMode === 'one' || repeatMode === 'all',
        hasNext: queue.length > 0 
    };
}
