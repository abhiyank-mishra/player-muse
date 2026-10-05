import { NextResponse } from 'next/server';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';

/**
 * Fallback API — finds a playable YouTube audio stream URL for a song by query string.
 * GET /api/music/fallback?query=Song+Name+Artist
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
        return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
    }

    try {
        const results = await YouTubeSearchEngine.search(query, 1);
        if (results && results.length > 0) {
            const match = results[0];
            const videoId = match.id.replace(/^yt_/, '');
            return NextResponse.json({
                url: `/api/music/stream?id=${videoId}`,
                source: 'youtube',
                name: match.name,
                artist: match.artist,
                image: match.image,
                id: match.id
            });
        }

        return NextResponse.json({ error: 'No matching track found' }, { status: 404 });
    } catch (e) {
        console.error('[Fallback] Search failed:', e);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
