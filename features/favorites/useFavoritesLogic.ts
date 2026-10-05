"use client";
import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Song } from '@/lib/types';
import EventBus from '@/core/events/EventBus';
export function useFavoritesLogic() {
  const { user, loading: authLoading, login } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { setQueueConfig } = usePlayer();

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    const handleLikeChange = () => {
      if (user) loadFavorites();
    };
    EventBus.on('likeChanged', handleLikeChange);
    return () => EventBus.off('likeChanged', handleLikeChange);
  }, [user]);

  const loadFavorites = async (isLoadMore = false) => {
    if (!user) return;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const likesRef = collection(db, 'users', user.uid, 'likes');
      let q;
      const limitCount = 10;

      if (isLoadMore && lastDoc) {
          q = query(likesRef, orderBy('likedAt', 'desc'), startAfter(lastDoc), limit(limitCount));
      } else {
          q = query(likesRef, orderBy('likedAt', 'desc'), limit(limitCount));
      }

      const querySnapshot = await getDocs(q);
      const newSongs = querySnapshot.docs.map(doc => ({
          ...doc.data()
      })) as Song[];

      if (isLoadMore) {
          setSongs(prev => [...prev, ...newSongs]);
      } else {
          setSongs(newSongs);
      }
      
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(newSongs.length === limitCount);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handlePlay = (song: Song, index: number) => {
    setQueueConfig(songs, index);
  };

  const handlePlayAll = (shuffle: boolean, shuffledSongs?: Song[]) => {
    const songsToPlay = shuffledSongs || songs;
    setQueueConfig(songsToPlay, 0);
  };

  return {
    state: { user, authLoading, songs, loading, hasMore, loadingMore },
    actions: { loadFavorites, handlePlay, handlePlayAll, login }
  };
}
