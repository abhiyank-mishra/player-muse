import { NextResponse } from 'next/server';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('query');

  if (!rawQuery || !rawQuery.trim()) {
    return NextResponse.json({ results: [] });
  }

  const query = rawQuery.trim();

  try {
    const ytList = await YouTubeSearchEngine.getSuggestions(query);

    const suggestions = ytList.map(text => ({
      type: 'query',
      id: `yt_${encodeURIComponent(text)}`,
      title: text,
      subtitle: 'Search suggestion',
      source: 'youtube'
    }));

    return NextResponse.json(
      { results: suggestions },
      { headers: { 'Cache-Control': 'public, max-age=1800, s-maxage=3600' } }
    );
  } catch (e) {
    console.error('Suggestions API error:', e);
    return NextResponse.json({ results: [] });
  }
}
