import { UnifiedSearchResult } from './search.types';
import { UnifiedSearchEngine } from './UnifiedSearchEngine';

export class ResultNormalizer {
  /**
   * Resolve the best 500x500 high-resolution image URL.
   */
  private static extractBestImage(item: any): string {
    let candidate = '';

    if (Array.isArray(item.image) && item.image.length > 0) {
      // Pick highest res first: index 2 (500x500) -> 1 (150x150) -> 0 (50x50)
      candidate = item.image[2] || item.image[1] || item.image[0] || '';
    } else if (typeof item.image === 'string') {
      candidate = item.image;
    } else if (item.coverImage) {
      candidate = item.coverImage;
    } else if (item.artwork_url) {
      candidate = item.artwork_url;
    } else if (item.user?.avatar_url) {
      candidate = item.user.avatar_url;
    }

    if (!candidate) return '/placeholder.png';

    // Upgrade low-res indicators to 500x500
    return candidate
      .replace(/50x50|150x150/g, '500x500')
      .replace('-large', '-t500x500');
  }

  /**
   * Normalize raw results from multiple sources into a uniform shape
   * suitable for RankingEngine.
   */
  static normalize(results: any[]): UnifiedSearchResult[] {
    return results.map(item => {
      // Handle curated playlists
      if (item.type === 'curated_playlist') {
        return {
          id: String(item.id),
          title: UnifiedSearchEngine.decodeHtml(item.name || item.title || 'Curated Playlist'),
          artist: UnifiedSearchEngine.decodeHtml(item.subtitle || 'Muse Curated'),
          duration: 0,
          image: this.extractBestImage(item),
          source: 'curated_playlist' as const,
          original: item
        };
      }

      const cleanTitle = UnifiedSearchEngine.decodeHtml(item.name || item.title || 'Unknown');
      const cleanArtist = UnifiedSearchEngine.decodeHtml(item.artist || 'Unknown Artist');
      const cleanAlbum = UnifiedSearchEngine.decodeHtml(item.album || '');

      return {
        id: String(item.id),
        title: cleanTitle,
        artist: cleanArtist,
        album: cleanAlbum,
        duration: item.duration || 0,
        image: this.extractBestImage(item),
        source: 'youtube' as const,
        likes: item.likes_count || item.likes || 0,
        playback: item.playback_count || item.playback || 0,
        reposts: item.reposts_count || item.reposts || 0,
        comments: item.comment_count || item.comments || 0,
        hasLyrics: item.has_lyrics === 'true' || item.has_lyrics === true,
        playCount: item.play_count ? parseInt(item.play_count) : (item.playCount || 0),
        year: item.year || '',
        language: item.language || '',
        nativeRank: item.nativeRank,
        original: item
      };
    });
  }
}
