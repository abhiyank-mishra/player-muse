import { 
  doc, 
  updateDoc, 
  increment, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  runTransaction,
  deleteDoc,
  startAfter
} from 'firebase/firestore';
import { db } from './firebase';
import { Song } from './types';
import EventBus from '@/core/events/EventBus';

export const toggleLike = async (userId: string, song: Song, isAdmin: boolean) => {
  const userLikeRef = doc(db, 'users', userId, 'likes', song.id);
  const songRef = doc(db, 'songs', song.id);

  try {
    let finalIsLiked = false;
    await runTransaction(db, async (transaction) => {
      const userLikeDoc = await transaction.get(userLikeRef);

      const isLiked = userLikeDoc.exists();
      finalIsLiked = !isLiked; // The new state

      if (isLiked) {
        transaction.delete(userLikeRef);
      } else {
        transaction.set(userLikeRef, {
          ...song,
          likedAt: serverTimestamp()
        });
      }
    });

    // Dispatch global event for live client updates
    if (typeof window !== 'undefined') {
        EventBus.emit('likeStateChanged', { songId: song.id, isLiked: finalIsLiked });
        import('@/lib/preferences').then(({ recordLikePreference }) => {
            recordLikePreference(song, finalIsLiked);
        }).catch(() => {});
    }
  } catch (error) {
    console.error("Toggle like failed", error);
    throw error;
  }
};



export const checkIfLiked = async (userId: string, songId: string) => {
  const userLikeRef = doc(db, 'users', userId, 'likes', songId);
  const docSnap = await getDoc(userLikeRef);
  return docSnap.exists();
};

export const toggleGlobalPin = async (song: Song) => {
    const globalRef = doc(db, 'global_explorer', song.id);
    const snap = await getDoc(globalRef);
    if (snap.exists()) {
        await deleteDoc(globalRef);
        return false;
    } else {
        await setDoc(globalRef, {
            ...song,
            pinnedAt: serverTimestamp()
        });
        return true;
    }
};

export const isPinnedToGlobal = async (songId: string) => {
    const globalRef = doc(db, 'global_explorer', songId);
    const snap = await getDoc(globalRef);
    return snap.exists();
};

export const getGlobalExplorer = async () => {
    const globalRef = collection(db, 'global_explorer');
    const q = query(globalRef, orderBy('pinnedAt', 'desc'), limit(20));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Song);
};

function getLocalDateString(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().split('T')[0];
  }
}

export const recordSongPlay = async (userId: string, song: Song) => {
  const now = new Date();
  const today = getLocalDateString(now);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = getLocalDateString(yesterdayDate);
  
  const statsRef = doc(db, 'users', userId, 'stats', 'daily');

  try {
    const statsSnap = await getDoc(statsRef);
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const existingPrev: any[] = Array.isArray(userData?.previousSongs) ? userData.previousSongs : [];

    const songArtwork = Array.isArray(song.image) ? song.image[song.image.length - 1] : (song.image || '');

    const currentSongObj = {
      id: song.id || '',
      name: song.name || '',
      artist: song.artist || 'Unknown Artist',
      image: songArtwork,
      url: song.url || '',
      duration: song.duration || 0,
      album: song.album || ''
    };

    const updatedPrevious = [
      currentSongObj,
      ...existingPrev.filter(s => s && s.id !== currentSongObj.id)
    ].slice(0, 6);

    // Helper to sync to main user doc
    const syncToUser = async (count: any, streak: any, date: string) => { 
         await updateDoc(userRef, {
             lastActive: serverTimestamp(),
             totalPlays: increment(1),
             lastPlayedSong: currentSongObj,
             previousSongs: updatedPrevious,
             playStats: {
                 date,
                 count,
                 streak
             }
         });
    };

    if (!statsSnap.exists()) {
      // First ever play
      await setDoc(statsRef, { count: 1, streak: 1, lastPlayedDate: today, date: today });
      await syncToUser(1, 1, today);
    } else {
      const data = statsSnap.data();
      const lastDate = data.date || data.lastPlayedDate;

      if (lastDate === today) {
        // Same day, just increment count
        await updateDoc(statsRef, { count: increment(1) });
        await updateDoc(userRef, {
            lastActive: serverTimestamp(),
            totalPlays: increment(1),
            lastPlayedSong: currentSongObj,
            previousSongs: updatedPrevious,
            'playStats.count': increment(1)
        });
      } else if (lastDate === yesterday) {
        // Consecutive day! Increment streak
        const newStreak = (data.streak || 0) + 1;
        await updateDoc(statsRef, { 
          count: 1, 
          streak: newStreak, 
          date: today 
        });
        await syncToUser(1, newStreak, today);
      } else {
        // Missed a day or more, reset streak
        await updateDoc(statsRef, { 
          count: 1, 
          streak: 1, 
          date: today 
        });
        await syncToUser(1, 1, today);
      }
    }
  } catch (e) {
    console.error("Failed to record play", e);
  }
};

export const getDailyStats = async (userId: string) => {
  const today = new Date().toISOString().split('T')[0];
  const statsRef = doc(db, 'users', userId, 'stats', 'daily');
  
  try {
    const docSnap = await getDoc(statsRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.date === today) {
        return { count: data.count || 0, streak: data.streak || 1 };
      }
      // If we haven't played today, we check if we played yesterday to show accurate current streak
      // but count for today is 0.
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];
      
      if (data.date === yesterday) {
        return { count: 0, streak: data.streak || 0 };
      }
      // Missed yesterday too, streak is effectively 0
      return { count: 0, streak: 0 };
    }
    return { count: 0, streak: 0 };
  } catch (e) {
    return { count: 0, streak: 0 };
  }
};

// Playlist Management
export const getUserPlaylists = async (userId: string, isPro = false) => {
  const playlistsRef = collection(db, 'users', userId, 'playlists');
  const snap = await getDocs(playlistsRef);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  // Normal users only see active playlists; Pro/Admin see everything
  if (!isPro) {
    return all.filter((p: any) => p.is_active !== false);
  }
  return all;
};

export const createPlaylist = async (userId: string, name: string, role: 'normal' | 'pro' | 'admin' = 'normal') => {
  const playlistsRef = collection(db, 'users', userId, 'playlists');

  // Enforce limits per role
  if (role !== 'pro') {
    const snap = await getDocs(playlistsRef);
    const limit = role === 'admin' ? 12 : 2;
    if (snap.size >= limit) {
      throw new Error(
        role === 'admin'
          ? `Admins can create up to ${limit} playlists.`
          : `Upgrade to Pro to create more playlists.`
      );
    }
  }

  const newDoc = doc(playlistsRef);
  await setDoc(newDoc, {
    name,
    songs: [],
    is_active: true,
    createdAt: serverTimestamp()
  });
  return { id: newDoc.id, name, songs: [], is_active: true };
};

export const deletePlaylist = async (userId: string, playlistId: string) => {
  const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
  await deleteDoc(playlistRef);
};

export const sanitizeSongData = (song: Song): Record<string, any> => {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(song)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
};

export const addToPlaylist = async (
  userId: string, 
  playlistId: string, 
  song: Song
): Promise<{ alreadyExists: boolean; playlistName: string }> => {
  const cleanSong = sanitizeSongData(song);
  const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
  const snap = await getDoc(playlistRef);
  
  if (!snap.exists()) {
    throw new Error('Playlist not found');
  }

  const playlistData = snap.data();
  const playlistName = playlistData?.name || 'Playlist';
  const existingSongs: any[] = playlistData?.songs || [];

  const alreadyExists = existingSongs.some((s: any) => s.id === cleanSong.id);
  if (alreadyExists) {
    return { alreadyExists: true, playlistName };
  }

  if (existingSongs.length >= 50) {
    throw new Error('Playlist is full (Max 50 songs)');
  }

  await updateDoc(playlistRef, {
    songs: arrayUnion(cleanSong)
  });

  if (typeof window !== 'undefined') {
    EventBus.emit('playlist:updated', { playlistId, song: cleanSong });
  }

  return { alreadyExists: false, playlistName };
};

export const removeFromPlaylist = async (userId: string, playlistId: string, song: Song) => {
  const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
  const snap = await getDoc(playlistRef);
  if (snap.exists()) {
    const existingSongs: any[] = snap.data()?.songs || [];
    const updatedSongs = existingSongs.filter((s: any) => s.id !== song.id);
    await updateDoc(playlistRef, {
      songs: updatedSongs
    });
    if (typeof window !== 'undefined') {
      EventBus.emit('playlist:updated', { playlistId, songId: song.id, removed: true });
    }
  }
};

export const renamePlaylist = async (userId: string, playlistId: string, newName: string) => {
    const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
    await updateDoc(playlistRef, {
      name: newName
    });
};

import { getSongWeight } from './preferences';

export const getPersonalizedRecommendations = async (currentSong: Song, limit: number = 5): Promise<Song[]> => {
    try {
        // 1. Fetch raw recommendations via our own API (Bypasses CORS)
        const params = new URLSearchParams({
            id: currentSong.id || '',
            name: currentSong.name || '',
            artist: currentSong.artist || '',
            limit: '20'
        });
        const res = await fetch(`/api/music/recommendations?${params}`);
        if (!res.ok) throw new Error('Failed to fetch recommendations');
        
        const rawRecos: Song[] = await res.json();
        
        // 2. Weight them against user preferences
        const weightedRecos = rawRecos.map(song => ({
            song,
            weight: getSongWeight(song)
        }));
        
        // 3. Sort by weight (Desc)
        weightedRecos.sort((a, b) => b.weight - a.weight);
        
        // 4. Return top N
        return weightedRecos.slice(0, limit).map(item => item.song);
    } catch (e) {
        console.error("Personalized Recos Error", e);
        return [];
    }
};
