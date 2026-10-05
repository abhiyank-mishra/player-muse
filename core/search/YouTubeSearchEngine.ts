import { Song } from '@/lib/types';
import { YouTubeRadioEngine } from '@/core/recommendation/YouTubeRadioEngine';

function parseDuration(str: string): number {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  return 0;
}

function cleanTitleForSearch(rawTitle: string): { title: string; movieOrArtist: string } {
  if (!rawTitle) return { title: '', movieOrArtist: '' };

  // Remove common YouTube tags like [Official Video], (Audio), (Lyrics), etc.
  let cleaned = rawTitle
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?!From|Movie|raaz)[^)]*\)/gi, ' ')
    .replace(/\b(official\s*(music|video|audio)?|lyric(s)?|full\s*song|video\s*song|hd\s*video|4k)\b/gi, ' ')
    .trim();

  // Often titles are formatted as: "Song Name - Movie | Artist" or "Song Name | Movie"
  const pipeParts = cleaned.split('|').map(p => p.trim()).filter(Boolean);
  const mainPart = pipeParts[0] || cleaned;

  let title = mainPart;
  let movieOrArtist = '';

  if (mainPart.includes(' - ')) {
    const dashParts = mainPart.split(' - ').map(p => p.trim()).filter(Boolean);
    title = dashParts[0];
    movieOrArtist = dashParts.slice(1).join(' ');
  } else if (pipeParts.length > 1) {
    movieOrArtist = pipeParts[1];
  }

  // Remove trailing lyrics / slowed / reverb tags
  title = title
    .replace(/\b(slowed\s*\+?\s*reverb|lofi|remix|acoustic|unplugged)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, movieOrArtist };
}

export class YouTubeSearchEngine {
  /**
   * Search YouTube for a query and resolve top 4-5 results to playable JioSaavn or YouTube songs.
   * Particularly powerful for lyric queries, dialogues, and rare tracks.
   */
  static async search(query: string, limit: number = 5): Promise<Song[]> {
    if (!query || !query.trim()) return [];

    try {
      const url = 'https://www.youtube.com/youtubei/v1/search';
      const body = {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'en',
            gl: 'IN'
          }
        },
        query: query.trim()
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) return [];

      const data = await res.json();
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (!Array.isArray(contents)) return [];

      const candidates: { name: string; artistHint: string; videoId: string; rawTitle: string; image: string; duration: number }[] = [];

      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents;
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          const v = item?.videoRenderer;
          if (!v || !v.videoId) continue;

          const rawTitle = v.title?.runs?.[0]?.text || '';
          if (!rawTitle) continue;

          // Skip full movies or videos longer than 12 minutes
          const lengthText = v.lengthText?.simpleText || '';
          const durationSeconds = parseDuration(lengthText);
          if (durationSeconds > 720) continue;

          const channel = v.ownerText?.runs?.[0]?.text || '';
          const { title: cleanName, movieOrArtist } = cleanTitleForSearch(rawTitle);
          if (!cleanName || cleanName.length < 2) continue;

          const thumbnails = v.thumbnail?.thumbnails || [];
          const bestThumb = thumbnails[thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

          candidates.push({
            name: cleanName,
            artistHint: movieOrArtist,
            videoId: v.videoId,
            rawTitle,
            image: bestThumb,
            duration: durationSeconds || 240
          });

          if (candidates.length >= limit) break;
        }
        if (candidates.length >= limit) break;
      }

      const songs: Song[] = [];
      const seen = new Set<string>();

      for (const c of candidates) {
        if (!c.videoId || seen.has(c.videoId)) continue;
        seen.add(c.videoId);

        songs.push({
          id: `yt_${c.videoId}`,
          name: c.name,
          artist: c.artistHint || 'YouTube',
          album: 'YouTube Music',
          image: [c.image, c.image, c.image],
          url: `/api/music/stream?id=${encodeURIComponent(c.videoId)}&title=${encodeURIComponent(c.name)}&artist=${encodeURIComponent(c.artistHint || '')}`,
          duration: c.duration,
          has_lyrics: 'false',
          language: 'hindi',
          year: new Date().getFullYear().toString(),
          release_date: '',
          source: 'youtube'
        });
      }

      return songs;
    } catch (e) {
      console.error('[YouTubeSearchEngine] Error:', e);
      return [];
    }
  }

  /**
   * Fast YouTube query suggestions
   */
  static async getSuggestions(query: string): Promise<string[]> {
    if (!query || !query.trim()) return [];
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query.trim())}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.[1]) ? data[1].slice(0, 5) : [];
    } catch {
      return [];
    }
  }
}
