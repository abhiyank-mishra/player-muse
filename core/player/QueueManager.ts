import { Song, PlayerState } from '@/lib/types';
import { getGlobalExplorer } from '@/lib/ranking';
import { getSongWeight } from '@/lib/preferences';

export interface NextSongResult {
    track: Song | null;
    index: number;
    queue: Song[];
    manualQueue: Song[];
    shouldStop: boolean;
}

export class QueueManager {
    /**
     * Calculates the next track to play based on shuffle, repeat modes, and queue exhaustion.
     * Integrates intelligent fallback (Trending/Global) if the queue ends.
     */
    static async getNext(state: PlayerState): Promise<NextSongResult> {
        // 1. Priority to manual queue
        if (state.manualQueue && state.manualQueue.length > 0) {
            const track = state.manualQueue[0];
            const newManualQueue = state.manualQueue.slice(1);
            return {
                track,
                index: state.currentIndex, // don't progress primary list index
                queue: state.queue,
                manualQueue: newManualQueue,
                shouldStop: false
            };
        }

        // 2. Primary Queue
        if (state.queue.length === 0) {
            return { track: null, index: -1, queue: [], manualQueue: [], shouldStop: true };
        }

        let nextIndex = state.currentIndex + 1;
        
        if (state.isShuffle && state.queue.length > 1) {
            // Pick a random index that isn't the current one
            let randomIndex = state.currentIndex;
            let attempts = 0;
            while (randomIndex === state.currentIndex && attempts < 5) {
                randomIndex = Math.floor(Math.random() * state.queue.length);
                attempts++;
            }
            nextIndex = randomIndex;
        } else if (nextIndex >= state.queue.length) {
            if (state.repeatMode === 'all') {
                nextIndex = 0;
            } else if (state.repeatMode === 'one') {
                nextIndex = state.currentIndex;
            } else {
                // Smart Fallback: End of queue -> Fetch Personalized Recommendations
                try {
                    if (state.currentSong) {
                        const recRes = await fetch(`/api/music/recommendations?id=${state.currentSong.id}&limit=10`);
                        if (recRes.ok) {
                            const recSongs = await recRes.json();
                            if (recSongs && recSongs.length > 0) {
                                // Weighted shuffle for recommendations
                                const weightedRecs = [...recSongs].sort((a, b) => getSongWeight(b) - getSongWeight(a));
                                return { 
                                    track: weightedRecs[0], 
                                    index: state.queue.length, 
                                    queue: [...state.queue, ...weightedRecs],
                                    manualQueue: [], 
                                    shouldStop: false 
                                };
                            }
                        }
                    }

                    // Secondary Fallback: Trending
                    const res = await fetch('/api/music/trending');
                    const trendingSongs = res.ok ? await res.json() : [];
                    if (trendingSongs && trendingSongs.length > 0) {
                        const weightedTrending = [...trendingSongs].sort((a, b) => getSongWeight(b) - getSongWeight(a));
                        return { 
                            track: weightedTrending[0], 
                            index: state.queue.length, 
                            queue: [...state.queue, ...weightedTrending],
                            manualQueue: [], 
                            shouldStop: false 
                        };
                    }
                    
                    const globalSongs = await getGlobalExplorer();
                    if (globalSongs && globalSongs.length > 0) {
                        const weightedGlobal = [...globalSongs].sort((a, b) => getSongWeight(b) - getSongWeight(a));
                        return { 
                            track: weightedGlobal[0], 
                            index: state.queue.length, 
                            queue: [...state.queue, ...weightedGlobal],
                            manualQueue: [], 
                            shouldStop: false 
                        };
                    }
                } catch (e) {
                    console.error("QueueManager Fallback failed", e);
                }
                
                return { track: null, index: state.currentIndex, queue: state.queue, manualQueue: [], shouldStop: true };
            }
        }
        
        return { 
            track: state.queue[nextIndex] || null, 
            index: nextIndex, 
            queue: state.queue,
            manualQueue: [], 
            shouldStop: false 
        };
    }

    /**
     * Resolves the previous track prioritizing the history stack over sequential queue.
     */
    static getPrevious(state: PlayerState, currentListenTime: number): { track: Song | null, newHistory: Song[], newIndex: number } {
        // If played more than 3 sec, signal to replay current (returning current index)
        if (currentListenTime > 3 && state.currentSong) {
            return { track: state.currentSong, newHistory: state.history, newIndex: state.currentIndex };
        }

        if (state.history.length > 0) {
            const newHistory = [...state.history];
            const previousSong = newHistory.pop() || null;
            // When popping history, we stay at current index conceptually or trust the track
            return { track: previousSong, newHistory: newHistory, newIndex: state.currentIndex };
        }

        let prevIndex = state.currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = state.queue.length - 1; 
        }
        
        return { track: state.queue[prevIndex] || null, newHistory: state.history, newIndex: prevIndex };
    }

    static pushHistory(history: Song[], newSong: Song | null): Song[] {
        if (!newSong) return history;
        return [...history, newSong].slice(-10); // Keep last 10
    }
}
