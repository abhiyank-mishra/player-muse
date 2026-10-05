import { decodeSaavnUrl } from './decoder';

function cleanTrackName(title: string): string {
  return (title || '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .replace(/\s*\[Official.*?\]/gi, '')
    .replace(/\s*\(Video.*?\)/gi, '')
    .replace(/\s*\[Video.*?\]/gi, '')
    .replace(/\s*\(Audio.*?\)/gi, '')
    .replace(/\s*\[Audio.*?\]/gi, '')
    .replace(/\s*\(Lyrical.*?\)/gi, '')
    .replace(/\s*\[Lyrical.*?\]/gi, '')
    .replace(/\s*\(Full Video.*?\)/gi, '')
    .replace(/\s*\|.*$/g, '')
    .replace(/\s*-.*$/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a high-fidelity (320kbps / 160kbps) direct CDN audio URL
 * for any given song title & artist.
 */
export async function resolveAudioStreamFallback(title: string, artist = ''): Promise<string | null> {
  const cleanTitle = cleanTrackName(title);
  const primaryArtist = (artist || '').split(',')[0]?.split('&')[0]?.trim();
  const query = primaryArtist ? `${cleanTitle} ${primaryArtist}` : cleanTitle;

  if (!cleanTitle) return null;

  try {
    const res = await fetch(`https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=android&q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/'
      },
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      const results = data.results || [];
      if (Array.isArray(results) && results.length > 0) {
        for (const item of results.slice(0, 3)) {
          const enc = item.more_info?.encrypted_media_url;
          if (enc) {
            const streamUrl = decodeSaavnUrl(enc);
            if (streamUrl && streamUrl.startsWith('https://')) {
              return streamUrl;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[AudioResolver] Saavn fallback search failed:', err);
  }

  // Fallback without artist name
  if (primaryArtist) {
    try {
      const res = await fetch(`https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=android&q=${encodeURIComponent(cleanTitle)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.jiosaavn.com/'
        },
        signal: AbortSignal.timeout(3500)
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        if (Array.isArray(results) && results.length > 0) {
          const enc = results[0].more_info?.encrypted_media_url;
          if (enc) {
            const streamUrl = decodeSaavnUrl(enc);
            if (streamUrl && streamUrl.startsWith('https://')) {
              return streamUrl;
            }
          }
        }
      }
    } catch {}
  }

  return null;
}
