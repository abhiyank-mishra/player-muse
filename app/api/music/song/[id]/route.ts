import { NextResponse } from 'next/server';
import { Song } from '@/lib/types';

export async function getYouTubeSongById(id: string): Promise<Song | null> {
  const videoId = id.replace(/^yt_/, '').trim();
  if (!videoId) return null;

  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    const title = data.title || 'YouTube Song';
    const artist = data.author_name || 'YouTube';
    const img = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      id: `yt_${videoId}`,
      name: title,
      artist: artist,
      album: 'YouTube',
      image: [img, img, img],
      url: `/api/music/stream?id=${videoId}`,
      duration: 240,
      has_lyrics: 'false',
      language: 'hindi',
      year: new Date().getFullYear().toString(),
      release_date: '',
      source: 'youtube'
    };
  } catch {
    return null;
  }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    
    if (!id) {
        return NextResponse.json(
            { error: 'Song ID is required' },
            { status: 400 }
        );
    }

    try {
        const song = await getYouTubeSongById(id);
        
        if (!song) {
            return NextResponse.json(
                { error: 'Song not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(song);
    } catch (e) {
        console.error('Error fetching song details:', e);
        return NextResponse.json(
            { error: 'Failed to fetch song details' },
            { status: 500 }
        );
    }
}
