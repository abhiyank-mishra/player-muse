import { getPreferences, getPreferredSeeds } from '@/lib/preferences';
import { ColabTasteProfile } from './colabTypes';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Builds a lightweight musical taste profile for the current user.
 * Derived from recent listen history, mood weights, and song plays.
 */
export function getMyTasteProfile(userName: string): ColabTasteProfile {
  const prefs = getPreferences();
  
  // 1. Top artists from recent history (weighted by recency)
  const artistCounts: Record<string, number> = {};
  (prefs.recentHistory || []).forEach((song, idx) => {
    const artist = song.artist?.split(',')[0]?.trim();
    if (artist && artist !== 'Unknown Artist' && artist !== 'Unknown') {
      const weight = Math.max(1, 20 - idx);
      artistCounts[artist] = (artistCounts[artist] || 0) + weight;
    }
  });

  let topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artist]) => artist);

  // Fallback: check preferred seeds if history is empty
  if (topArtists.length === 0) {
    try {
      const seeds = getPreferredSeeds();
      const artistSeed = seeds.find((s) => s.type === 'artist');
      if (artistSeed?.value) {
        topArtists.push(artistSeed.value);
      }
    } catch {
      // ignore
    }
  }

  // 2. Top moods from moodWeights
  let topMoods = Object.entries(prefs.moodWeights || {})
    .filter(([_, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mood]) => mood);

  // 3. Dominant language
  const langCounts: Record<string, number> = {};
  (prefs.recentHistory || []).forEach((song) => {
    const lang = song.language?.toLowerCase();
    if (lang && lang !== 'unknown') {
      langCounts[lang] = (langCounts[lang] || 0) + 1;
    }
  });
  const dominantLanguage = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'hindi';

  // 4. Recent seed song IDs
  const recentSeedIds = (prefs.recentHistory || [])
    .slice(0, 5)
    .map((s) => s.id)
    .filter(Boolean);

  // If user has zero history (fresh session / guest), provide mainstream friendly seeds
  // so the blend generator always produces recommendations for their turn
  if (topArtists.length === 0 && recentSeedIds.length === 0) {
    topArtists = ['Arijit Singh', 'Pritam'];
    if (topMoods.length === 0) topMoods = ['chill'];
  }

  return {
    topArtists,
    topMoods,
    dominantLanguage,
    recentSeedIds,
    userName: userName || 'Friend',
  };
}

/**
 * Syncs the current user's taste profile to their member slot in the Colab room.
 */
export async function syncTasteProfileToRoom(roomId: string, userId: string, profile: ColabTasteProfile) {
  if (!roomId || !userId) return;
  try {
    const roomRef = doc(db, 'colab_rooms', roomId);
    await updateDoc(roomRef, {
      [`members.${userId}.tasteProfile`]: profile,
      updatedAt: Date.now(),
    });
  } catch (err) {
    // Non-blocking
    console.warn('[ColabTaste] Failed to sync taste profile:', err);
  }
}
