export interface YouTubeRecoTrack {
  name: string;
  artist: string;
  ytVideoId: string;
}

class LRUCache<K, V> {
  private cache: Map<K, V>;
  private max: number;

  constructor(max: number = 200) {
    this.cache = new Map();
    this.max = max;
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const val = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, val);
      return val;
    }
    return undefined;
  }

  set(key: K, value: V) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, value);
  }
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

class TTLCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number) {
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
  }
}

const videoIdCache = new LRUCache<string, string | null>(200);
const radioQueueCache = new TTLCache<string, YouTubeRecoTrack[]>();

export class YouTubeRadioEngine {
  private static async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  static cleanYouTubeTitle(title: string): string {
    let clean = title;
    const toRemove = [
      /\s*\((?:official|music|video|audio|lyric|lyrics|\s)+\)/ig,
      /\s*\[(?:official|music|video|audio|lyric|lyrics|\s)+\]/ig,
      /\s*\|.*/g,
      /\s*(?:ft|feat|featuring)\.?\s+.*/ig,
    ];
    for (const regex of toRemove) {
      clean = clean.replace(regex, '');
    }
    return clean.trim();
  }

  static async resolveVideoId(songName: string, artist: string): Promise<string | null> {
    const cacheKey = `${songName} ${artist}`;
    const cached = videoIdCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const cleanName = (songName || '')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
        .replace(/\(.*?\)|\[.*?\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || songName;
      const query = `${cleanName} ${artist} audio`;
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
        query
      };

      const res = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        videoIdCache.set(cacheKey, null);
        return null;
      }

      const data = await res.json();
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (Array.isArray(contents)) {
        for (const section of contents) {
          const items = section?.itemSectionRenderer?.contents;
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item.videoRenderer?.videoId) {
                const videoId = item.videoRenderer.videoId;
                videoIdCache.set(cacheKey, videoId);
                return videoId;
              }
            }
          }
        }
      }

      videoIdCache.set(cacheKey, null);
      return null;
    } catch (error) {
      console.error('YouTubeRadioEngine.resolveVideoId error:', error);
      videoIdCache.set(cacheKey, null);
      return null;
    }
  }

  static async fetchRadioQueue(videoId: string): Promise<YouTubeRecoTrack[]> {
    const cached = radioQueueCache.get(videoId);
    if (cached) {
      return cached;
    }

    try {
      const url = 'https://music.youtube.com/youtubei/v1/next';
      const body = {
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240101.01.00',
            hl: 'en',
            gl: 'IN'
          }
        },
        videoId,
        playlistId: `RDAMVM${videoId}`
      };

      const res = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const tabs = data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
      
      const tracks: YouTubeRecoTrack[] = [];

      if (Array.isArray(tabs) && tabs[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents) {
        const contents = tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents;
        
        for (const item of contents) {
          if (item.playlistPanelVideoRenderer) {
            const renderer = item.playlistPanelVideoRenderer;
            const title = renderer.title?.runs?.[0]?.text;
            const artist = renderer.longBylineText?.runs?.[0]?.text;
            const ytVideoId = renderer.videoId;

            if (title && ytVideoId) {
              tracks.push({
                name: this.cleanYouTubeTitle(title),
                artist: artist || '',
                ytVideoId
              });
            }
          }
        }
      }

      if (tracks.length > 0) {
        radioQueueCache.set(videoId, tracks, 10 * 60 * 1000); // 10 minutes cache
      }

      return tracks;
    } catch (error) {
      console.error('YouTubeRadioEngine.fetchRadioQueue error:', error);
      return [];
    }
  }

  static async getRecommendations(
    seedSong: { name: string; artist?: string; id?: string }, 
    limit?: number,
    opts?: { negativeTitles?: string[] }
  ): Promise<YouTubeRecoTrack[]> {
    try {
      const videoId = await this.resolveVideoId(seedSong.name, seedSong.artist || '');
      if (!videoId) {
        return [];
      }

      const queue = await this.fetchRadioQueue(videoId);
      
      const cleanAlpha = (s: string) => this.cleanYouTubeTitle(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      const seedNorm = cleanAlpha(seedSong.name);

      const negativeNorms = new Set(
        (opts?.negativeTitles || []).map(cleanAlpha).filter(Boolean)
      );

      const filtered = queue.filter(track => {
        // Exclude the exact seed video
        if (track.ytVideoId === videoId) return false;

        const trackNorm = cleanAlpha(track.name);
        if (!trackNorm) return false;

        // Exclude identical or title substring matches of the seed song
        if (seedNorm && (seedNorm === trackNorm || trackNorm.includes(seedNorm) || seedNorm.includes(trackNorm))) {
          return false;
        }

        // Exclude user-skipped songs
        if (negativeNorms.has(trackNorm)) {
          return false;
        }

        return true;
      });

      return limit ? filtered.slice(0, limit) : filtered;
    } catch (error) {
      console.error('YouTubeRadioEngine.getRecommendations error:', error);
      return [];
    }
  }

  static async getMultiSeedRecommendations(
    seeds: { name: string; artist?: string }[], 
    limitPerSeed?: number,
    opts?: { negativeTitles?: string[] }
  ): Promise<YouTubeRecoTrack[]> {
    try {
      const promises = seeds.map(seed => this.getRecommendations(seed, limitPerSeed, opts));
      const results = await Promise.all(promises);

      const maxLength = Math.max(...results.map(r => r.length), 0);
      const interleaved: YouTubeRecoTrack[] = [];
      const seenNames = new Set<string>();
      
      const cleanAlpha = (s: string) => this.cleanYouTubeTitle(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      for (const seed of seeds) {
        const norm = cleanAlpha(seed.name);
        if (norm) seenNames.add(norm);
      }

      for (let i = 0; i < maxLength; i++) {
        for (const seedResults of results) {
          if (i < seedResults.length) {
            const track = seedResults[i];
            const normName = cleanAlpha(track.name);
            if (normName && !seenNames.has(normName)) {
              seenNames.add(normName);
              interleaved.push(track);
            }
          }
        }
      }

      return interleaved;
    } catch (error) {
      console.error('YouTubeRadioEngine.getMultiSeedRecommendations error:', error);
      return [];
    }
  }
}
