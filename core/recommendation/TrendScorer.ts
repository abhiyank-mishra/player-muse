import { Song } from '@/lib/types';

export class TrendScorer {
  /**
   * Scores the trend and catalog relevance of a candidate song (0.1 to 1.0).
   * Incorporates play counts, release recency, search rank, metadata completeness,
   * and language affinity to provide granular relative scoring instead of flat 1.0 values.
   */
  static score(song: Song): number {
    let score = 0.2; // Baseline

    // 1. Play / Stream count velocity (log scale)
    const playCount = (song as any).play_count || (song as any).playback_count || 0;
    if (playCount > 0) {
      const logPlays = Math.log10(playCount + 1);
      // Normalized between 0.05 and 0.35 (e.g. 10k plays = ~0.2, 1M plays = ~0.3)
      score += Math.min(logPlays / 20, 0.35);
    } else {
      score += 0.1; // Default play assumption for catalog tracks
    }

    // 2. Release Recency / Freshness
    const currentYear = new Date().getFullYear();
    const releaseYear = song.year ? parseInt(song.year) : 0;
    if (releaseYear > 0) {
      if (releaseYear >= currentYear - 1) {
        score += 0.25; // Hot / Current release
      } else if (releaseYear >= currentYear - 4) {
        score += 0.15; // Recent hit
      } else if (releaseYear >= currentYear - 10) {
        score += 0.10; // Evergreen era
      } else {
        score += 0.05; // Nostalgia / Golden classic
      }
    }

    // 3. Search / Chart Native Rank (if available)
    if (song.nativeRank !== undefined && song.nativeRank > 0) {
      // rank 1 -> +0.2, rank 10 -> +0.02
      score += Math.max(0, 0.2 - (song.nativeRank * 0.018));
    }

    // 4. Production & Catalog Quality Signals
    if (song.has_lyrics === 'true' || song.has_lyrics === true as any) {
      score += 0.1;
    }
    if (song.duration >= 120 && song.duration <= 360) {
      score += 0.08; // Ideal radio length (2 to 6 minutes)
    }
    if (song.album && song.album !== song.name) {
      score += 0.07; // Proper album release
    }

    // 5. Title Cleanliness (penalize low-effort slowed/reverb/karaoke re-uploads)
    const lowerTitle = song.name?.toLowerCase() || '';
    if (
      lowerTitle.includes('karaoke') ||
      lowerTitle.includes('instrumental') ||
      lowerTitle.includes('bass boosted') ||
      lowerTitle.includes('slowed reverb')
    ) {
      score -= 0.15;
    }

    // 6. Language Affinity for Indian Core Audience
    const lang = song.language?.toLowerCase();
    if (lang === 'hindi' || lang === 'punjabi') {
      score += 0.12;
    } else if (lang === 'english' || lang === 'telugu' || lang === 'tamil') {
      score += 0.06;
    }

    // Normalize boundary between 0.10 and 1.0
    return Math.min(Math.max(Math.round(score * 100) / 100, 0.1), 1.0);
  }
}
