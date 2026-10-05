import { searchCuratedPlaylists } from '@/lib/curatedPlaylists';
import { QueryIntentParser } from './QueryIntentParser';
import { ResultNormalizer } from './ResultNormalizer';
import { RankingEngine } from './RankingEngine';
import { YouTubeSearchEngine } from './YouTubeSearchEngine';

export class UnifiedSearchEngine {
  /**
   * Comprehensive HTML entity decoder (handles named entities, decimal, and hex).
   */
  static decodeHtml(s: string): string {
    if (!s || typeof s !== 'string') return '';
    return s
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&hellip;/g, '…')
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return code > 0 ? String.fromCharCode(code) : '';
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = parseInt(hex, 16);
        return code > 0 ? String.fromCharCode(code) : '';
      })
      .trim();
  }

  /**
   * Main orchestrator for unified search.
   * Fetches from YouTube and curated playlists.
   */
  static async search(query: string, page: number = 1) {
    const validPage = Math.max(1, page || 1);

    // ── Step 1: Parse user intent ──
    const intent = QueryIntentParser.parse(query);

    // ── Step 2: Fetch sources in parallel ──
    const [curatedPlaylists, youtubeSongs] = await Promise.allSettled([
      validPage === 1 ? searchCuratedPlaylists(query) : Promise.resolve([]),
      YouTubeSearchEngine.search(query, 20)
    ]);

    // ── Step 3: Extract raw data ──
    const curatedData = curatedPlaylists.status === 'fulfilled' 
      ? curatedPlaylists.value.map(p => ({ ...p, type: 'curated_playlist' })) 
      : [];
    const ytData = youtubeSongs.status === 'fulfilled' ? youtubeSongs.value : [];

    // ── Step 4: Normalize into uniform shape ──
    const normalized = ResultNormalizer.normalize(ytData);

    // ── Step 5: Rank using the intelligent ranking engine ──
    const ranked = RankingEngine.rank(normalized, intent, query);

    // ── Step 6: Deduplicate and preserve ordering ──
    const finalSongs: any[] = [];
    const seenSongIds = new Set<string>();

    for (const r of ranked) {
      const s = r.original;
      if (s && s.id && !seenSongIds.has(s.id)) {
        seenSongIds.add(s.id);
        finalSongs.push(s);
      }
    }

    // Fallback: If ranked was empty but raw had items
    for (const ys of ytData) {
      if (ys && ys.id && !seenSongIds.has(ys.id)) {
        seenSongIds.add(ys.id);
        finalSongs.push(ys);
      }
    }

    return {
      artists: [],
      playlists: curatedData,
      songs: finalSongs,
      intent
    };
  }
}
