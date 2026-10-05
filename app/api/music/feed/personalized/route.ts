import { NextResponse } from 'next/server';
import { YouTubeRadioEngine } from '@/core/recommendation/YouTubeRadioEngine';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';
import { Song } from '@/lib/types';

// In-memory cache for personalized feeds (10 min TTL)
const feedCache = new Map<string, { data: { songs: Song[], isPersonalized: boolean }, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;
const FEED_SIZE = 25;

function normalizeTitle(name: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const artists = (searchParams.get('artists') || '').split(',').map(a => a.trim()).filter(Boolean).slice(0, 3);
    const mood = searchParams.get('mood') || '';
    const seedNames = (searchParams.get('seedNames') || '').split('||').map(s => s.trim()).filter(Boolean).slice(0, 5);
    const seedArtists = (searchParams.get('seedArtists') || '').split('||').map(s => s.trim());

    const cacheKey = `${artists.join('_')}__${mood}__${seedNames.join('_')}`;

    const cached = feedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=120', 'X-Cache': 'HIT' }
      });
    }

    const excludeTitles = new Set(seedNames.map(n => normalizeTitle(n)).filter(Boolean));
    const isPersonalized = seedNames.length > 0 || artists.length > 0;

    // 1. YouTube Neural Recommendations from seeds
    const ytPromise: Promise<Song[]> = (async () => {
      if (seedNames.length === 0) return [];
      try {
        const seeds = seedNames.slice(0, 3).map((name, i) => ({ name, artist: seedArtists[i] || '' }));
        const ytTracks = await YouTubeRadioEngine.getMultiSeedRecommendations(seeds, 20);
        if (ytTracks.length === 0) return [];
        
        return ytTracks.map(t => ({
          id: `yt_${t.ytVideoId}`,
          name: t.name,
          artist: t.artist || 'YouTube Music',
          album: 'YouTube Music',
          image: [
            `https://i.ytimg.com/vi/${t.ytVideoId}/hqdefault.jpg`,
            `https://i.ytimg.com/vi/${t.ytVideoId}/hqdefault.jpg`,
            `https://i.ytimg.com/vi/${t.ytVideoId}/hqdefault.jpg`
          ],
          url: `/api/music/stream?id=${t.ytVideoId}`,
          duration: 240,
          has_lyrics: 'false',
          language: 'hindi',
          year: new Date().getFullYear().toString(),
          release_date: '',
          source: 'youtube' as const
        }));
      } catch {
        return [];
      }
    })();

    // 2. YouTube Search for Liked Artists
    const artistPromises: Promise<Song[]>[] = artists.map(artist =>
      YouTubeSearchEngine.search(`${artist} hit songs`, 6).catch(() => [])
    );

    // 3. YouTube Search for Active Mood
    const moodPromise: Promise<Song[]> = mood
      ? YouTubeSearchEngine.search(`${mood} songs hindi`, 8).catch(() => [])
      : Promise.resolve([]);

    const [ytRecos, artistResults, moodSongs] = await Promise.all([
      ytPromise,
      Promise.all(artistPromises),
      moodPromise
    ]);

    const artistSongs = artistResults.flat();

    // 4. Merge candidates
    const merged: Song[] = [];
    const seen = new Set<string>();

    const addCandidate = (s: Song) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      const norm = normalizeTitle(s.name);
      if (excludeTitles.has(norm)) return false;
      seen.add(s.id);
      if (norm) excludeTitles.add(norm);
      merged.push(s);
      return true;
    };

    // Add neural recommendations first
    for (const s of ytRecos) {
      if (merged.length >= FEED_SIZE) break;
      addCandidate(s);
    }

    // Interleave artist songs and mood songs
    const maxFallback = Math.max(artistSongs.length, moodSongs.length);
    for (let i = 0; i < maxFallback && merged.length < FEED_SIZE; i++) {
      if (i < artistSongs.length) addCandidate(artistSongs[i]);
      if (i < moodSongs.length) addCandidate(moodSongs[i]);
    }

    // Fallback: If still short, fetch trending songs
    if (merged.length < 15) {
      const trending = await YouTubeSearchEngine.search('Top trending hindi songs', 15);
      for (const s of trending) {
        if (merged.length >= FEED_SIZE) break;
        addCandidate(s);
      }
    }

    const result = {
      songs: merged.slice(0, FEED_SIZE),
      isPersonalized
    };

    feedCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=120',
        'X-Cache': 'MISS',
      }
    });
  } catch (error) {
    console.error('Personalized Feed Error:', error);
    return NextResponse.json({ songs: [], isPersonalized: false }, { status: 500 });
  }
}
