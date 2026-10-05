import { NextResponse } from 'next/server';
import { YouTubeRadioEngine } from '@/core/recommendation/YouTubeRadioEngine';
import { Song } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const name = searchParams.get('name') || '';
  const artist = searchParams.get('artist') || '';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10') || 10, 1), 50);

  if (!id && !name) {
    return NextResponse.json({ error: 'Song ID or Name is required' }, { status: 400 });
  }

  try {
    const seedTrack = {
      name: name || id || '',
      artist: artist || '',
      ytVideoId: id ? id.replace(/^yt_/, '') : undefined
    };

    const recos = await YouTubeRadioEngine.getRecommendations(seedTrack, limit);
    if (!recos || recos.length === 0) {
      return NextResponse.json([]);
    }

    const songs: Song[] = recos.map(t => ({
      id: `yt_${t.ytVideoId}`,
      name: t.name,
      artist: t.artist || 'YouTube',
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
      source: 'youtube'
    }));

    return NextResponse.json(songs);
  } catch (error) {
    console.error('Recommendations API Error:', error);
    return NextResponse.json([]);
  }
}
