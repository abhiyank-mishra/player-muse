import { Song } from '@/lib/types';
import { getPreferences, getUserTasteSignals } from '@/lib/preferences';

export class RadioQueueGenerator {
    /**
     * Generates a smart queue of songs related to the seed song.
     * Strategy (upgraded):
     * 1. PRIMARY: YouTube Music neural radio (best quality, neural recommendations)
     * 2. FALLBACK: JioSaavn recommendation API + artist search
     * 3. LAST RESORT: Language-aware trending
     * 4. Post-processing: Sliding window artist cooldown + title deduplication
     */
    static async generateQueue(seedSong: Song): Promise<Song[]> {
        try {
            const prefs = getPreferences();

            // Launch YouTube Music recommendation and artist search in parallel
            const [ytResult, artistResult] = await Promise.allSettled([
                this.fetchYouTubeRecommendations(seedSong),
                this.fetchArtistSongs(seedSong),
            ]);

            const ytSongs = ytResult.status === 'fulfilled' ? ytResult.value : [];
            const artistSongs = artistResult.status === 'fulfilled' ? artistResult.value : [];

            // Merge candidates: YouTube neural recos first, then artist songs
            const seedId = seedSong.id;
            const recentIds = new Set(
                (prefs.recentHistory || []).slice(0, 5).map(s => s.id)
            );
            const seen = new Set<string>([seedId]);
            const seenTitles = new Set<string>();

            // Add seed song title to prevent recommending variants of it
            const seedTitleNorm = this.normalizeTitle(seedSong.name);
            if (seedTitleNorm) seenTitles.add(seedTitleNorm);

            const skippedTitles = new Set(
                (prefs.skippedSongTitles || []).map(t => this.normalizeTitle(t)).filter(Boolean)
            );

            const isExcluded = (titleNorm: string) => {
                if (!titleNorm) return false;
                if (seenTitles.has(titleNorm)) return true;
                if (skippedTitles.has(titleNorm)) return true;
                if (seedTitleNorm && (titleNorm === seedTitleNorm || titleNorm.includes(seedTitleNorm) || seedTitleNorm.includes(titleNorm))) {
                    return true;
                }
                return false;
            };

            const merged: Song[] = [];

            // Phase 1: YouTube Music recommendations
            for (const song of ytSongs) {
                if (merged.length >= 25) break;
                if (seen.has(song.id) || recentIds.has(song.id)) continue;
                const titleNorm = this.normalizeTitle(song.name);
                if (isExcluded(titleNorm)) continue;
                seen.add(song.id);
                if (titleNorm) seenTitles.add(titleNorm);
                merged.push(song);
            }

            // Phase 2: Interleave artist songs for diversity
            for (const s of artistSongs) {
                if (merged.length >= 25) break;
                const titleNorm = this.normalizeTitle(s.name);
                if (!seen.has(s.id) && !recentIds.has(s.id) && !isExcluded(titleNorm)) {
                    seen.add(s.id);
                    if (titleNorm) seenTitles.add(titleNorm);
                    merged.push(s);
                }
            }

            if (merged.length > 0) {
                return this.applySlidingWindowCooldown(merged, seedSong, 25);
            }

            // Fallback: trending YouTube songs
            return await this.fetchTrendingFallback(seedSong);
        } catch (e) {
            console.error("RadioQueueGenerator failed to generate queue", e);
            return [];
        }
    }

    /**
     * PRIMARY: Fetch recommendations via YouTube Music neural radio engine.
     */
    private static async fetchYouTubeRecommendations(seedSong: Song): Promise<Song[]> {
        try {
            const songName = seedSong.name;
            const artist = seedSong.artist?.split(',')[0]?.trim() || '';
            if (!songName || songName === 'Unknown Song') return [];

            const taste = getUserTasteSignals();

            const params = new URLSearchParams({
                name: songName,
                artist: artist,
                limit: '25',
                resolve: 'true',
            });

            if (taste.skippedTitles && taste.skippedTitles.length > 0) {
                params.set('skipped', JSON.stringify(taste.skippedTitles));
            }
            if (taste.likedArtists && taste.likedArtists.length > 0) {
                params.set('likedArtists', JSON.stringify(taste.likedArtists));
            }

            const res = await fetch(`/api/music/recommendations/youtube?${params}`);
            if (!res.ok) return [];
            const songs: Song[] = await res.json();
            return Array.isArray(songs) ? songs : [];
        } catch {
            return [];
        }
    }

    private static async fetchArtistSongs(seedSong: Song): Promise<Song[]> {
        try {
            let artist = seedSong.artist?.split(',')[0]?.trim();
            if (!artist || artist === 'Unknown Artist' || artist === 'Unknown') {
                const prefs = getPreferences();
                artist = prefs.likedArtists?.[0];
            }
            if (!artist || artist === 'Unknown Artist' || artist === 'Unknown') return [];

            const res = await fetch(`/api/music/search?query=${encodeURIComponent(artist)}&limit=12`);
            if (!res.ok) return [];
            const data = await res.json();
            const songs: Song[] = data.songs || [];

            // Filter to only songs that are actually by this artist (fuzzy match)
            const artistLower = artist.toLowerCase();
            return songs.filter(s =>
                s.artist?.toLowerCase().includes(artistLower) && s.id !== seedSong.id
            ).slice(0, 8);
        } catch {
            return [];
        }
    }

    private static async fetchTrendingFallback(seedSong: Song): Promise<Song[]> {
        try {
            const trendRes = await fetch('/api/music/trending');
            if (!trendRes.ok) return [];
            const trendingSongs: Song[] = await trendRes.json();

            // Prefer songs in the same language as the seed
            const seedLang = seedSong.language?.toLowerCase();
            if (seedLang && seedLang !== 'unknown') {
                const sameLang = trendingSongs.filter(s =>
                    s.language?.toLowerCase() === seedLang && s.id !== seedSong.id
                );
                if (sameLang.length >= 5) return sameLang.slice(0, 10);
            }

            return trendingSongs.filter(s => s.id !== seedSong.id).slice(0, 10);
        } catch {
            return [];
        }
    }

    /**
     * Sliding Window Artist Cooldown:
     * No more than 2 songs by the same primary artist within any 8-song window.
     * This prevents A-B-A-B monotony while still allowing popular artists to appear.
     */
    private static applySlidingWindowCooldown(
        candidates: Song[],
        seedSong: Song,
        maxOutput: number
    ): Song[] {
        const finalQueue: Song[] = [];
        const overflow: Song[] = [];
        const WINDOW_SIZE = 8;
        const MAX_PER_WINDOW = 2;

        for (const song of candidates) {
            if (finalQueue.length >= maxOutput) break;

            const primaryArtist = song.artist?.split(',')[0]?.trim().toLowerCase() || '';

            // Count how many times this artist appears in the last WINDOW_SIZE songs
            const windowStart = Math.max(0, finalQueue.length - WINDOW_SIZE);
            let artistInWindow = 0;
            for (let j = windowStart; j < finalQueue.length; j++) {
                const qArtist = finalQueue[j].artist?.split(',')[0]?.trim().toLowerCase() || '';
                if (qArtist === primaryArtist) artistInWindow++;
            }

            if (artistInWindow >= MAX_PER_WINDOW) {
                overflow.push(song);
                continue;
            }

            finalQueue.push(song);
        }

        // Pad from overflow if we are short
        for (const song of overflow) {
            if (finalQueue.length >= maxOutput) break;
            if (!finalQueue.find(s => s.id === song.id)) {
                finalQueue.push(song);
            }
        }

        return finalQueue;
    }

    /**
     * Normalize a song title for deduplication.
     * "Galliyan (From Ek Villain)" -> "galliyan"
     */
    private static normalizeTitle(name: string): string {
        if (!name) return '';
        return name
            .toLowerCase()
            .replace(/\(.*?\)/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\s*-\s*remix.*$/i, '')
            .replace(/\s*-\s*unplugged.*$/i, '')
            .replace(/\s*-\s*acoustic.*$/i, '')
            .replace(/\s*returns?\s*$/i, '')
            .replace(/[^\w\s]/g, '')
            .trim()
            .replace(/\s+/g, ' ');
    }
}
