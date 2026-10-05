import { NextResponse } from 'next/server';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const artist = searchParams.get('artist');

  if (!name) {
    return NextResponse.json({ error: 'Song name is required' }, { status: 400 });
  }

  // Clean the title from common Spotify noise
  const cleanName = name
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\[feat\..*?\]/gi, '')
    .replace(/- Remastered.*$/gi, '')
    .replace(/\(Remastered.*?\)/gi, '')
    .replace(/\[Remastered.*?\]/gi, '')
    .replace(/\(Explicit\)/gi, '')
    .replace(/\[Explicit\]/gi, '')
    .trim();

  const query = `${cleanName} ${artist || ''}`.trim();

  try {
    const results = await YouTubeSearchEngine.search(query, 1);
    if (results && results.length > 0) {
      return NextResponse.json(results[0]);
    }
    return NextResponse.json({ error: 'No match found' }, { status: 404 });
  } catch (e) {
    console.error('Spotify match error:', e);
    return NextResponse.json({ error: 'Match failed' }, { status: 500 });
  }
}
