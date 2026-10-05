import { Song } from '@/lib/types';
import { RankedRecommendation, UserProfile } from './recommendation.types';
import { UserProfileAnalyzer } from './UserProfileAnalyzer';
import { TrendScorer } from './TrendScorer';

export class RecommendationEngine {
  static rank(
    candidates: Song[], 
    sessionHistory: Song[], 
    allTimeHistory: Song[],
    likedArtists: string[] = []
  ): Song[] {
    if (!candidates || candidates.length === 0) return [];

    const profile = UserProfileAnalyzer.analyze(allTimeHistory, likedArtists);
    const recentSession = sessionHistory.slice(0, 5); // Look at more recent songs for mood detection
    
    // Cold start mode only if neither history nor liked artists exist
    const isColdStart = allTimeHistory.length === 0 && likedArtists.length === 0;

    // Detect immediate session mood
    const sessionProfile = UserProfileAnalyzer.analyze(recentSession, likedArtists);
    const activeSessionMood = sessionProfile.dominantMood;

    // Detect dominant language from session
    const langCounts: Record<string, number> = {};
    recentSession.forEach(s => {
        const lang = s.language?.toLowerCase();
        if (lang && lang !== 'unknown') langCounts[lang] = (langCounts[lang] || 0) + 1;
    });
    const sessionLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const scoredCandidates: RankedRecommendation[] = candidates.map(song => {
      // 1. Global Trend (40%)
      const globalTrend = TrendScorer.score(song);

      // 2. User Affinity (25%)
      let userAffinity = 0;
      if (!isColdStart) {
         const songArtistLower = (song.artist || '').toLowerCase();
         // Check match against profile top artists
         for (const topArtist of profile.topArtists) {
             if (songArtistLower.includes(topArtist.toLowerCase().trim())) {
                 userAffinity += 0.6;
                 break;
             }
         }
         // Check match against explicit liked artists
         for (const likedArtist of likedArtists) {
             if (songArtistLower.includes(likedArtist.toLowerCase().trim())) {
                 userAffinity += 0.4;
                 break;
             }
         }
         
         if (profile.dominantMood && UserProfileAnalyzer.matchesMood(song, profile.dominantMood)) {
             userAffinity += 0.4;
         }
         userAffinity = Math.min(userAffinity, 1.0);
      }

      // 3. Session Mood (10%)
      let sessionMoodScore = 0;
      if (activeSessionMood && UserProfileAnalyzer.matchesMood(song, activeSessionMood)) {
         sessionMoodScore = 1.0;
      }

      // 4. Language Match (15%) — KEY for Indian users
      let languageScore = 0;
      if (sessionLang && song.language) {
          if (song.language.toLowerCase() === sessionLang) {
              languageScore = 1.0; // Same language = strong boost
          } else if (sessionLang === 'hindi' && song.language.toLowerCase() === 'punjabi') {
              languageScore = 0.5; // Hindi listeners often enjoy Punjabi too
          } else if (sessionLang === 'punjabi' && song.language.toLowerCase() === 'hindi') {
              languageScore = 0.5;
          }
      } else if (!isColdStart) {
          // Default: boost Hindi/Punjabi for Indian user base
          const lang = song.language?.toLowerCase();
          if (lang === 'hindi' || lang === 'punjabi') {
              languageScore = 0.3;
          }
      }

      // 5. Freshness Score (-10% to +10%)
      let freshness = 0.5; // Neutral
      const isInSession = sessionHistory.some(s => s.id === song.id);
      if (isInSession) {
          freshness = -1.0; // Heavy penalty for tracks already played THIS session
      } else if (song.year && parseInt(song.year) >= new Date().getFullYear() - 1) {
          freshness = 1.0; // Boost recent releases mildly
      } else if (song.year && parseInt(song.year) < new Date().getFullYear() - 5) {
          freshness = -0.3; // Mild penalty for old songs
      }

      // Final Score Calculation
      let finalScore = 0;
      
      if (isColdStart) {
         // Cold Start: 70% Trend, 10% Language, 20% Freshness
         finalScore = (globalTrend * 0.7) + (languageScore * 0.1) + (freshness * 0.2);
      } else {
         // Personalized Hybrid
         finalScore = 
            (globalTrend * 0.40) +
            (userAffinity * 0.25) +
            (languageScore * 0.15) +
            (sessionMoodScore * 0.10) +
            (Math.max(freshness, 0) * 0.10); 
            // Negative freshness penalty
            if (freshness < 0) {
                finalScore -= 0.3; // Subtract explicitly if played recently
            }
      }

      return {
          ...song,
          _recommendationScore: finalScore
      };
    });

    // Sort heavily by recommendation score
    scoredCandidates.sort((a, b) => (b._recommendationScore || 0) - (a._recommendationScore || 0));

    // Remove duplicates natively
    const seenIds = new Set<string>();
    const uniqueCandidates = scoredCandidates.filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
    });

    // Diversity Injection (Every 5th track is a generic high global trend track)
    const finalStream: Song[] = [];
    const mainResults = [...uniqueCandidates];
    
    // Extract top 10 purely trending tracks for injection pool
    const pureTrendingPool = [...uniqueCandidates]
        .sort((a, b) => TrendScorer.score(b) - TrendScorer.score(a))
        .slice(0, 10);

    let injectionPointer = 0;
    
    for (let i = 0; i < mainResults.length; i++) {
        // Every 5th position (index 4, 9, 14), attempt to inject diversity
        if (i > 0 && i % 4 === 0 && !isColdStart && injectionPointer < pureTrendingPool.length) {
            const injectTrack = pureTrendingPool[injectionPointer];
            if (!finalStream.some(s => s.id === injectTrack.id)) {
                finalStream.push(injectTrack);
                injectionPointer++;
                continue; 
            } else {
                injectionPointer++;
            }
        }
        
        if (!finalStream.some(s => s.id === mainResults[i].id)) {
            finalStream.push(mainResults[i]);
        }
    }

    // Clean up internal properties before returning
    return finalStream.map(s => {
        const { _recommendationScore, ...rest } = s as any;
        return rest;
    });
  }

  /**
   * Normalizes a song name for diversity comparison.
   * "Galliyan (From Ek Villain)" → "galliyan"
   * "Galliyan Returns" → "galliyan"
   * "TERI GALLIYAN (Acoustic Cover)" → "teri galliyan"
   */
  private static normalizeSongName(name: string): string {
      if (!name) return '';
      return name
          .toLowerCase()
          .replace(/\(.*?\)/g, '')            // Remove parenthetical info: (From...), (Acoustic Cover)
          .replace(/\[.*?\]/g, '')            // Remove bracket info
          .replace(/\s*-\s*remix.*$/i, '')    // Remove "- Remix..."
          .replace(/\s*-\s*unplugged.*$/i, '')
          .replace(/\s*-\s*acoustic.*$/i, '')
          .replace(/\s*returns?\s*$/i, '')    // Remove "Returns" suffix
          .replace(/[^\w\s]/g, '')            // Remove special chars
          .trim()
          .replace(/\s+/g, ' ');             // Collapse whitespace
  }

  static async generateRadioQueue(seedSong: Song, userPreferences: any): Promise<Song[]> {
    try {
        let targetId = seedSong.id;
        const isNumericSaavnId = /^[0-9]+$/.test(seedSong.id);

        // If song is from YouTube/SoundCloud or has non-numeric ID, resolve a matching JioSaavn track ID
        if (!isNumericSaavnId || seedSong.source === 'youtube' || seedSong.source === 'soundcloud') {
            try {
                const searchQ = `${seedSong.name} ${seedSong.artist || ''}`.trim();
                const searchRes = await fetch(`/api/music/search?query=${encodeURIComponent(searchQ)}`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    const match = (searchData.songs || [])[0];
                    if (match?.id && /^[0-9]+$/.test(match.id)) {
                        targetId = match.id;
                    }
                }
            } catch {
                // ignore resolution error
            }
        }

        let candidates: Song[] = [];
        if (/^[0-9]+$/.test(targetId)) {
            const recRes = await fetch(`/api/music/recommendations?id=${targetId}&limit=30&raw=true`);
            if (recRes.ok) {
                candidates = await recRes.json();
            }
        }

        // Fallback: If recommendation API returned empty, search for more songs by this artist
        if (!candidates || candidates.length === 0) {
            const primaryArtist = seedSong.artist?.split(',')[0]?.trim();
            if (primaryArtist && primaryArtist !== 'Unknown Artist' && primaryArtist !== 'Unknown') {
                try {
                    const searchRes = await fetch(`/api/music/search?query=${encodeURIComponent(primaryArtist)}&limit=20`);
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        candidates = searchData.songs || [];
                    }
                } catch {
                    // ignore
                }
            }
        }

        if (candidates && candidates.length > 0) {
            // Filter out the seed song and recently played
            const recentIds = userPreferences?.recentHistory?.slice(0, 10).map((s: Song) => s.id) || [];
            const filteredCandidates = candidates.filter(c => c.id !== seedSong.id && !recentIds.includes(c.id));
            
            // Rank using user preferences + liked artists
            const ranked = this.rank(
                filteredCandidates, 
                userPreferences?.recentHistory || [],
                userPreferences?.recentHistory || [],
                userPreferences?.likedArtists || []
            );

                // === CRITICAL: Song-name deduplication ===
                // Prevents recommending 8 versions of "Galliyan" 
                const finalQueue: Song[] = [];
                let lastArtist = seedSong.artist;
                const usedSongNames = new Set<string>();

                // Add the seed song's normalized name to prevent recommending variants of it
                const seedNameNorm = this.normalizeSongName(seedSong.name);
                if (seedNameNorm) usedSongNames.add(seedNameNorm);

                for (const song of ranked) {
                    const nameNorm = this.normalizeSongName(song.name);
                    
                    // Skip if a version of this song name was already added
                    if (nameNorm && usedSongNames.has(nameNorm)) continue;
                    
                    // Skip consecutive same-artist for variety 
                    if (song.artist === lastArtist && finalQueue.length > 0) continue;

                    finalQueue.push(song);
                    lastArtist = song.artist;
                    if (nameNorm) usedSongNames.add(nameNorm);
                    
                    if (finalQueue.length >= 15) break;
                }

                // If strict deduplication left us short, pad from remaining ranked
                if (finalQueue.length < 10) {
                    for (const song of ranked) {
                        if (!finalQueue.find(s => s.id === song.id)) {
                            const nameNorm = this.normalizeSongName(song.name);
                            // Allow the same song name only if we're really short
                            if (nameNorm && usedSongNames.has(nameNorm) && finalQueue.length >= 5) continue;
                            finalQueue.push(song);
                            if (nameNorm) usedSongNames.add(nameNorm);
                        }
                        if (finalQueue.length >= 15) break;
                    }
                }

                return finalQueue;
            }
        } catch (e) {
            console.error("generateRadioQueue failed", e);
        }
        return [];
    }
}
