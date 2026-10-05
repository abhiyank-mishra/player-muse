import { NextResponse } from 'next/server';
import { YouTubeRadioEngine, type YouTubeRecoTrack } from '@/core/recommendation/YouTubeRadioEngine';
import { Song } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const artist = searchParams.get('artist') || '';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 50);
  const skippedParam = searchParams.get('skipped');
  const likedArtistsParam = searchParams.get('likedArtists');

  if (!name) {
    return NextResponse.json({ error: 'Song name is required' }, { status: 400 });
  }

  // Parse skipped song titles (negative feedback)
  let skippedList: string[] = [];
  if (skippedParam) {
    try {
      if (skippedParam.startsWith('[')) {
        skippedList = JSON.parse(skippedParam);
      } else {
        skippedList = skippedParam.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch {}
  }

  // Parse liked artists for affinity prioritization within the same mood
  let likedArtists: string[] = [];
  if (likedArtistsParam) {
    try {
      if (likedArtistsParam.startsWith('[')) {
        likedArtists = JSON.parse(likedArtistsParam);
      } else {
        likedArtists = likedArtistsParam.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch {}
  }

  try {
    // 1. Fetch neural radio recommendations anchored strictly to the seed song's mood & genre
    const ytRecos = await YouTubeRadioEngine.getRecommendations(
      { name, artist },
      Math.max(limit * 2, 40),
      { negativeTitles: skippedList }
    );

    if (!ytRecos || ytRecos.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Softly prioritize candidates matching user's liked artists within this mood
    if (likedArtists.length > 0) {
      const artistLowerSet = new Set(likedArtists.map(a => a.toLowerCase().trim()));
      ytRecos.sort((a, b) => {
        const aMatch = artistLowerSet.has((a.artist || '').toLowerCase().trim()) ? 1 : 0;
        const bMatch = artistLowerSet.has((b.artist || '').toLowerCase().trim()) ? 1 : 0;
        return bMatch - aMatch;
      });
    }

    // 3. Build set of titles to strictly exclude (seed song + user-skipped songs)
    const excludeSet = new Set<string>();
    const seedNorm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seedNorm) excludeSet.add(seedNorm);

    for (const skipped of skippedList) {
      const norm = skipped.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm) excludeSet.add(norm);
    }

    // 4. Return direct YouTube tracks
    const resolvedSongs: Song[] = [];
    const seen = new Set<string>();

    for (const t of ytRecos) {
      if (resolvedSongs.length >= limit) break;
      if (!t.ytVideoId || seen.has(t.ytVideoId)) continue;
      
      const norm = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (excludeSet.has(norm)) continue;
      
      seen.add(t.ytVideoId);
      resolvedSongs.push({
        id: `yt_${t.ytVideoId}`,
        name: t.name,
        artist: t.artist || 'YouTube',
        album: 'YouTube Music',
        image: [
          `https://i.ytimg.com/vi/${t.ytVideoId}/hqdefault.jpg`,
          `https://i.ytimg.com/vi/${t.ytVideoId}/hqdefault.jpg`,
          `https://i.ytimg.com/vi/${t.ytVideoId}/hqdefault.jpg`
        ],
        url: t.ytVideoId,
        duration: 240,
        has_lyrics: 'false',
        language: 'hindi',
        year: new Date().getFullYear().toString(),
        release_date: '',
        source: 'youtube'
      });
    }

    return NextResponse.json(resolvedSongs, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' }
    });
  } catch (error: any) {
    console.error('[YouTube Reco API] Error:', error?.message || error);
    return NextResponse.json([], { status: 200 });
  }
}
