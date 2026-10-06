
import { Song } from './types';

// ... imports
const PREFS_KEY = 'muse_user_preferences';
const GUEST_PLAYS_KEY = 'muse_guest_plays';

interface Preferences {
  moodWeights: { [key: string]: number };
  songWeights: { [id: string]: number };
  recentHistory: Song[]; // Track last 20 songs
  likedSongIds: string[];
  likedArtists: string[];
  skippedSongTitles?: string[];
}

const DEFAULT_PREFS: Preferences = {
  moodWeights: {
    romantic: 0,
    sad: 0,
    gym: 0,
    chill: 0,
    bollywood: 0,
    punjabi: 0,
    english: 0
  },
  songWeights: {},
  recentHistory: [],
  likedSongIds: [],
  likedArtists: [],
  skippedSongTitles: []
};

// ... getPreferences, savePreferences unchanged ...

export function getPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  const stored = localStorage.getItem(PREFS_KEY);
  if (!stored) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(stored);
    // Migration: ensure arrays exist
    if (!parsed.recentHistory) parsed.recentHistory = [];
    if (!parsed.likedSongIds) parsed.likedSongIds = [];
    if (!parsed.likedArtists) parsed.likedArtists = [];
    return parsed;
  } catch (e) {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: Preferences) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function recordLikePreference(song: Song, isLiked: boolean) {
  const prefs = getPreferences();
  if (!prefs.likedSongIds) prefs.likedSongIds = [];
  if (!prefs.likedArtists) prefs.likedArtists = [];

  const artist = song.artist?.split(',')[0]?.trim();

  if (isLiked) {
    if (!prefs.likedSongIds.includes(song.id)) {
      prefs.likedSongIds.push(song.id);
    }
    if (artist && artist !== 'Unknown Artist' && !prefs.likedArtists.includes(artist)) {
      prefs.likedArtists.push(artist);
    }
    prefs.songWeights[song.id] = (prefs.songWeights[song.id] || 0) + 3;
  } else {
    prefs.likedSongIds = prefs.likedSongIds.filter(id => id !== song.id);
  }
  savePreferences(prefs);
}

export function recordSkipPreference(song: Song, playDuration: number, totalDuration: number) {
  if (!song || !song.id) return;
  const prefs = getPreferences();
  
  // Fast skip (< 20s or < 25% duration): clear negative feedback signal
  const percentPlayed = totalDuration > 0 ? playDuration / totalDuration : 0;
  if (playDuration > 20 && percentPlayed > 0.25) return;

  // 1. Decrement song weight (demote disliked song)
  if (prefs.songWeights[song.id]) {
    prefs.songWeights[song.id] = Math.max(0, Math.round((prefs.songWeights[song.id] - 1.5) * 10) / 10);
    if (prefs.songWeights[song.id] <= 0.2) delete prefs.songWeights[song.id];
  }

  // 2. Mildly cool down mood weights so session adapts away from rejected mood
  // 3. Track skipped title for negative signal filtering in recommendations
  if (song.name) {
    const prevSkipped = prefs.skippedSongTitles || [];
    prefs.skippedSongTitles = [...prevSkipped.filter(t => t !== song.name), song.name].slice(-20);
  }

  savePreferences(prefs);
}

/**
 * Returns structured taste signals: user's top-played/liked seeds and negative skip signals.
 */
export function getUserTasteSignals() {
  const prefs = getPreferences();

  // Find top 3 most listened songs with positive weights or liked status
  const topWeightedIds = Object.entries(prefs.songWeights || {})
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const topSeeds = (prefs.recentHistory || [])
    .filter(s => topWeightedIds.includes(s.id) || (prefs.likedSongIds || []).includes(s.id))
    .slice(0, 3)
    .map(s => ({ name: s.name, artist: s.artist?.split(',')[0]?.trim() || '' }));

  const skippedTitles = (prefs.skippedSongTitles || []).slice(-15);

  return {
    topSeeds,
    skippedTitles,
    likedArtists: (prefs.likedArtists || []).slice(0, 5)
  };
}

export function updateWeights(song: Song, playDuration: number, totalDuration: number) {
  const prefs = getPreferences();
  
  // Rule: Only count if played for > 30s OR > 50% of duration
  const minimumTime = 30; // seconds
  const minimumPercent = 0.5;

  const percentPlayed = totalDuration > 0 ? playDuration / totalDuration : 0;

  if (playDuration < minimumTime && percentPlayed < minimumPercent) {
      // Record negative skip feedback signal
      recordSkipPreference(song, playDuration, totalDuration);
      return; 
  }

  // 1. Apply Exponential Time-Decay to prevent permanent taste lock-in
  for (const key of Object.keys(prefs.moodWeights)) {
    prefs.moodWeights[key] = Math.round(prefs.moodWeights[key] * 0.96 * 10) / 10;
    if (prefs.moodWeights[key] > 50) prefs.moodWeights[key] = 50; // Cap
  }
  for (const id of Object.keys(prefs.songWeights)) {
    prefs.songWeights[id] = Math.round(prefs.songWeights[id] * 0.95 * 10) / 10;
    if (prefs.songWeights[id] < 0.2) delete prefs.songWeights[id]; // Prune stale weights
    else if (prefs.songWeights[id] > 30) prefs.songWeights[id] = 30; // Cap
  }

  // 2. Update Song Weight (Explicit play count)
  prefs.songWeights[song.id] = (prefs.songWeights[song.id] || 0) + 1;
  
  // 3. Update Recent History (Session Context)
  const existingIndex = prefs.recentHistory.findIndex(s => s.id === song.id);
  if (existingIndex > -1) prefs.recentHistory.splice(existingIndex, 1);
  
  prefs.recentHistory.unshift(song); // Add to front
  if (prefs.recentHistory.length > 20) prefs.recentHistory.pop(); // Keep max 20

  // 4. Detect and Update Mood Weights — Word-Bounded Regex + Artist Match
  const text = `${song.name} ${song.album} ${song.artist}`.toLowerCase();
  const artist = song.artist?.toLowerCase() || '';
  
  // Romantic
  if (
    /\b(love|romantic|pyaar|ishq|dil|dilbar|sanam|jaan|humsafar|deewana|mohabbat|tum|wafa|shiddat|saiyaan|naina|valentine)\b/i.test(text) ||
    /\b(arijit singh|atif aslam|shreya ghoshal|jubin nautiyal|mohit chauhan|armaan malik|darshan raval|sanam|jasleen royal)\b/i.test(artist)
  ) {
    prefs.moodWeights.romantic += 1;
  }

  // Sad / Heartbreak
  if (
    /\b(sad|dard|broken|bewafa|tanhai|lonely|rula|cry|gham|judai|alvida|bichhad|aansoo|chhod|khamoshi|tadap|maahi|kho gaye|bhula|yaad|tanha)\b/i.test(text) ||
    /\b(b praak|jagjit singh|kk|mustafa zahid|bilal saeed|ankit tiwari)\b/i.test(artist)
  ) {
    prefs.moodWeights.sad += 1;
  }

  // Energetic / Party / Dance
  if (
    /\b(gym|workout|fitness|power|hardcore|party|dance|beat|bass|remix|dj|club|nachle|thumka|sharab|peg|daaru|bhangra|dhol|pataka|swag|hookah|dhamaka)\b/i.test(text) ||
    /\b(badshah|honey singh|diljit dosanjh|karan aujla|guru randhawa|neha kakkar|nucleya|ap dhillon|harrdy sandhu)\b/i.test(artist)
  ) {
    prefs.moodWeights.gym += 1;
  }

  // Chill / Lofi / Indie
  if (
    /\b(chill|lofi|relax|study|sleep|soft|peace|nature|acoustic|unplugged|slowed|reverb|chai|hawa|barish|subah|shaam|raat|sukoon|khoya|sitara)\b/i.test(text) ||
    /\b(prateek kuhad|anuv jain|ritviz|when chai met toast|zaeden|lucky ali|osho jain|twin strings|talwiinder)\b/i.test(artist)
  ) {
    prefs.moodWeights.chill += 1;
  }
  
  // Language weights
  if (song.language?.toLowerCase() === 'hindi') prefs.moodWeights.bollywood += 1;
  if (song.language?.toLowerCase() === 'punjabi') prefs.moodWeights.punjabi += 1;
  if (song.language?.toLowerCase() === 'english') prefs.moodWeights.english += 1;

  savePreferences(prefs);
}

export function getPreferredSeeds(): { type: 'song' | 'mood' | 'artist', value: string }[] {
    const prefs = getPreferences();
    const seeds: { type: 'song' | 'mood' | 'artist', value: string }[] = [];
    
    // 1. Session Analysis (Recency Bias) - Limit to 5 for fast adaptation
    const sessionWindow = prefs.recentHistory.slice(0, 5);
    
    if (sessionWindow.length > 0) {
        // Find most frequent artist in recent window (Weighted by recency)
        const artistCounts: {[key: string]: number} = {};
        sessionWindow.forEach((s, idx) => {
            const artist = s.artist.split(',')[0].trim();
            const weight = 10 - idx; // 10 for most recent, 1 for 10th recent
            artistCounts[artist] = (artistCounts[artist] || 0) + weight;
        });
        const artistsByFreq = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]);
        if (artistsByFreq[0]) {
            seeds.push({ type: 'artist', value: artistsByFreq[0][0] });
        }

        // Find most frequent mood in recent window (Weighted by recency)
        const sessionMoods: {[key: string]: number} = {};
        sessionWindow.forEach((s, idx) => {
             const weight = 10 - idx;
             const text = `${s.name} ${s.album} ${s.artist}`.toLowerCase();
             if (text.match(/love|romantic|pyaar|ishq|dil|sweet|valentine/)) sessionMoods.romantic = (sessionMoods.romantic || 0) + weight;
             if (text.match(/sad|dard|broken|bewafa|tanhai|lonely|cry/)) sessionMoods.sad = (sessionMoods.sad || 0) + weight;
             if (text.match(/gym|workout|power|hard|beast|party|dance/)) sessionMoods.gym = (sessionMoods.gym || 0) + weight;
             if (text.match(/chill|lofi|relax|sleep|peace|soft/)) sessionMoods.chill = (sessionMoods.chill || 0) + weight;
        });
        const moodsByFreq = Object.entries(sessionMoods).sort((a, b) => b[1] - a[1]);
        if (moodsByFreq[0]) {
            seeds.push({ type: 'mood', value: moodsByFreq[0][0] });
        }

        // Add the very last song played as a seed for immediate relevance
        seeds.push({ type: 'song', value: sessionWindow[0].id });
    }

    // 2. Fallback to liked artists / songs if session history is empty
    if (seeds.length === 0) {
        if (prefs.likedArtists && prefs.likedArtists.length > 0) {
            seeds.push({ type: 'artist', value: prefs.likedArtists[0] });
        }
        if (prefs.likedSongIds && prefs.likedSongIds.length > 0) {
            seeds.push({ type: 'song', value: prefs.likedSongIds[0] });
        }
    }

    // 3. Fallback to long-term top song if seeds are still empty
    if (seeds.length === 0) {
        let topSongId = '';
        let maxSongWeight = 0;
        Object.entries(prefs.songWeights).forEach(([id, weight]) => {
            if (weight > maxSongWeight) {
                maxSongWeight = weight;
                topSongId = id;
            }
        });
        if (topSongId) seeds.push({ type: 'song', value: topSongId });
    }

    return seeds;
}

export function getSongWeight(song: Song): number {
  const prefs = getPreferences();
  let weight = 1; // Base weight
  
  // Explicit liked song boost (very high priority)
  if (prefs.likedSongIds && prefs.likedSongIds.includes(song.id)) {
    weight += 20;
  }

  // Liked artist boost
  const primaryArtist = song.artist?.split(',')[0]?.trim().toLowerCase();
  if (primaryArtist && prefs.likedArtists?.some(a => a.toLowerCase().includes(primaryArtist) || primaryArtist.includes(a.toLowerCase()))) {
    weight += 10;
  }

  // Specific song boost (play count)
  weight += (prefs.songWeights[song.id] || 0) * 5;
  
  // Mood/Genre boost
  const text = `${song.name} ${song.album} ${song.artist}`.toLowerCase();
  if (text.match(/love|romantic|pyaar|ishq|dil|sweet|valentine|dilbar/)) weight += prefs.moodWeights.romantic;
  if (text.match(/sad|dard|broken|bewafa|tanhai|lonely|rula|cry|gham/)) weight += prefs.moodWeights.sad;
  if (text.match(/gym|workout|fitness|power|hard|beast|party|dance|beat|bass/)) weight += prefs.moodWeights.gym;
  if (text.match(/chill|lofi|relax|study|sleep|soft|peace|nature/)) weight += prefs.moodWeights.chill;
  
  // Language boost
  if (song.language?.toLowerCase() === 'hindi') weight += prefs.moodWeights.bollywood;
  if (song.language?.toLowerCase() === 'punjabi') weight += prefs.moodWeights.punjabi;
  if (song.language?.toLowerCase() === 'english') weight += prefs.moodWeights.english;

  return weight;
}

export function getGuestPlayCount(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(GUEST_PLAYS_KEY) || '0');
}

export function incrementGuestPlayCount() {
  if (typeof window === 'undefined') return;
  const count = getGuestPlayCount() + 1;
  localStorage.setItem(GUEST_PLAYS_KEY, count.toString());
}

export function resetGuestPlayCount() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_PLAYS_KEY);
}

const PREVIOUS_SONGS_KEY = 'muse_previous_songs';

export function getPreviousSongs(): Song[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PREVIOUS_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function recordPreviousSong(song: Song): Song[] {
  if (typeof window === 'undefined' || !song || !song.name) return [];
  try {
    const current = getPreviousSongs();
    const cleanSong: Song = {
      id: song.id || '',
      name: song.name,
      artist: song.artist || 'Unknown Artist',
      album: song.album || '',
      image: Array.isArray(song.image) ? song.image : [song.image || ''],
      url: song.url || '',
      duration: song.duration || 0,
      has_lyrics: song.has_lyrics || 'false',
      language: song.language || '',
      year: song.year || '',
      release_date: song.release_date || '',
      source: song.source || 'saavn'
    };
    // Prepend to front, deduplicate by id, retain max 6 songs (FIFO drop oldest after 6)
    const updated = [cleanSong, ...current.filter(s => s && s.id !== cleanSong.id)].slice(0, 6);
    localStorage.setItem(PREVIOUS_SONGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('muse:previous_songs_updated', { detail: updated }));
    return updated;
  } catch {
    return [];
  }
}

