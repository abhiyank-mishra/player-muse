import { NextResponse } from 'next/server';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';
import { Song } from '@/lib/types';

// In-memory cache for discover songs (30 minutes TTL)
let cachedDiscover: Song[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function GET() {
  try {
    if (cachedDiscover && cachedDiscover.length > 0 && Date.now() < cacheExpiry) {
      return NextResponse.json(cachedDiscover, {
        headers: {
          'Cache-Control': 'public, max-age=900, s-maxage=1800, stale-while-revalidate=86400',
          'X-Cache': 'HIT',
        },
      });
    }

    // Fetch fresh Discover tracks across diverse music categories from YouTube
    const [hindiHits, trendingIndia, punjabiHits, romanticSongs] = await Promise.all([
      YouTubeSearchEngine.search('Top Bollywood Hindi Songs 2026', 15),
      YouTubeSearchEngine.search('Trending Indian Music Hits', 15),
      YouTubeSearchEngine.search('Latest Punjabi Hit Songs', 12),
      YouTubeSearchEngine.search('Best Hindi Romantic Songs', 12),
    ]);

    const combined: Song[] = [];
    const seen = new Set<string>();

    for (const list of [hindiHits, trendingIndia, punjabiHits, romanticSongs]) {
      for (const song of list) {
        if (!song || !song.id || seen.has(song.id)) continue;
        seen.add(song.id);
        combined.push(song);
      }
    }

    if (combined.length > 0) {
      cachedDiscover = combined;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
    }

    return NextResponse.json(combined, {
      headers: {
        'Cache-Control': 'public, max-age=900, s-maxage=1800, stale-while-revalidate=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Discover API Error:', error);
    return NextResponse.json(cachedDiscover || []);
  }
}
