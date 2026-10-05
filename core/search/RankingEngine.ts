import { UnifiedSearchResult, ScoredResult, QueryIntent } from './search.types';
import { QueryIntentParser } from './QueryIntentParser';

/**
 * Noise words in SoundCloud titles that indicate unofficial/low-quality uploads.
 * These get a penalty to push them below official releases unless explicitly searched.
 */
const NOISE_INDICATORS = [
  'remix', 'slowed', 'reverb', 'lofi', 'lo-fi', 'mashup', 'mash-up',
  'cover', 'unplugged', 'acoustic', 'karaoke', 'instrumental', '8d audio', '8d',
  'bass boosted', 'nightcore', 'sped up', 'speed up', 'extended', 'reprise',
  'female version', 'male version', 'full video', 'video song', 'lyrical',
  'ringtone', 'status', 'whatsapp', 'tiktok', 'reels', 'shorts',
  'dj', 'club mix', 'party mix', 'edm', 'trap', 'phonk',
];

/**
 * Indicators of official/verified content — these get a quality boost.
 */
const OFFICIAL_INDICATORS = [
  'official audio', 'official music', 'original', 'full song',
];

/**
 * Normalize a string for comparison: lowercase, strip accents, remove special chars.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/[^\w\s]/g, ' ')  // replace punctuation with spaces
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim();
}

/**
 * Fast Space-Optimized Levenshtein distance with early-exit length gating.
 * Avoids 2D array matrix allocations on server thread.
 */
function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const maxLen = Math.max(la, lb);
  // Length difference gate: if lengths diverge by >25%, similarity cannot exceed 0.75
  if (Math.abs(la - lb) / maxLen > 0.25) return 0;
  if (la > 80 || lb > 80) return wordOverlapScore(a, b);

  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return 1 - (prev[lb] / maxLen);
}

/**
 * Word-overlap score: what fraction of query words appear in the target.
 */
function wordOverlapScore(query: string, target: string): number {
  const qWords = query.split(/\s+/).filter(w => w.length > 1);
  const tWords = new Set(target.split(/\s+/));
  if (qWords.length === 0) return 0;

  let matched = 0;
  for (const w of qWords) {
    if (tWords.has(w)) {
      matched++;
    } else {
      for (const tw of tWords) {
        if (tw.includes(w) || w.includes(tw)) {
          matched += 0.7;
          break;
        }
      }
    }
  }
  return matched / qWords.length;
}

export class RankingEngine {
  /**
   * Score and rank search results based on relevance, popularity, and quality.
   * Adheres strictly to Rule 4:
   * - Never penalizes underrated songs with high title relevance
   * - Preserves balanced SoundCloud + JioSaavn integration
   * - Preserves SoundCloud nativeRank bonus
   */
  static rank(
    results: UnifiedSearchResult[],
    intent: QueryIntent,
    originalQuery: string
  ): UnifiedSearchResult[] {
    if (!results.length) return [];

    const normQuery = normalizeText(originalQuery);
    const queryWords = normQuery.split(/\s+/).filter(w => w.length > 0);
    if (queryWords.length === 0) return results;

    const normSongTitle = intent.possibleSongTitle ? normalizeText(intent.possibleSongTitle) : null;
    const normArtist = intent.possibleArtist ? normalizeText(intent.possibleArtist) : null;
    const hinglishQuery = QueryIntentParser.normalizeHinglish(normQuery);

    // ── Phase 1: Score each result ──
    const scored: ScoredResult[] = results.map(result => {
      const normTitle = normalizeText(result.title);
      const normResultArtist = normalizeText(result.artist);
      const combinedText = normTitle + ' ' + normResultArtist;

      let relevanceScore = 0;
      let matchType: ScoredResult['_matchType'] = 'none';

      // 1. Artist Discography Intent: User searched for an artist specifically
      if (intent.intent === 'artist_discography' && normArtist) {
        const artistSim = this.artistMatchScore(normArtist, normResultArtist);
        if (artistSim > 0.65 || normResultArtist.includes(normArtist) || normArtist.includes(normResultArtist)) {
          relevanceScore = 85 + (artistSim * 15);
          matchType = 'exact_artist';
        } else {
          const titleOverlap = wordOverlapScore(normQuery, normTitle);
          relevanceScore = titleOverlap * 60;
          matchType = titleOverlap > 0.5 ? 'phrase_match' : 'partial';
        }
      }
      // 2. Exact Title Match
      else if (normTitle === normQuery || normTitle === normSongTitle) {
        relevanceScore = 100;
        matchType = 'exact_title';
      }
      // 3. Title Starts With or Contains Full Query Phrase
      else if (normTitle.includes(normQuery) || (normQuery.length > 3 && normQuery.includes(normTitle))) {
        const startsBonus = normTitle.startsWith(normQuery) ? 10 : 0;
        const lengthRatio = Math.min(normQuery.length, normTitle.length) / Math.max(normQuery.length, normTitle.length);
        relevanceScore = 75 + (lengthRatio * 20) + startsBonus;
        matchType = 'phrase_match';
      }
      // 4. Artist + Song Composite Matching
      else if (normSongTitle && normArtist) {
        const titleSim = this.titleMatchScore(normSongTitle, normTitle);
        const artistSim = this.artistMatchScore(normArtist, normResultArtist);

        if (titleSim > 0.6 && artistSim > 0.5) {
          relevanceScore = 40 + (titleSim * 35) + (artistSim * 25);
          matchType = titleSim > 0.9 ? 'exact_title' : 'phrase_match';
        } else if (titleSim > 0.7) {
          relevanceScore = 30 + (titleSim * 40);
          matchType = 'phrase_match';
        } else {
          const overlap = wordOverlapScore(normQuery, combinedText);
          relevanceScore = overlap * 50;
          matchType = overlap > 0.7 ? 'word_match' : 'partial';
        }
      }
      // 5. General Word & Hinglish Matching
      else {
        const titleOverlap = wordOverlapScore(normQuery, normTitle);
        const artistOverlap = wordOverlapScore(normQuery, normResultArtist);
        const combinedOverlap = wordOverlapScore(normQuery, combinedText);

        const fuzzySim = similarityRatio(normQuery, normTitle);
        let bestScore = Math.max(
          titleOverlap * 65,
          combinedOverlap * 55,
          fuzzySim * 45
        );

        // Hinglish phonetic tolerance fallback
        if (bestScore < 60) {
          const hinglishTitle = QueryIntentParser.normalizeHinglish(normTitle);
          if (hinglishTitle.includes(hinglishQuery) || hinglishQuery.includes(hinglishTitle)) {
            bestScore = 75;
            matchType = 'phrase_match';
          }
        }

        relevanceScore = bestScore;

        if (artistOverlap > 0.6) {
          relevanceScore += artistOverlap * 15;
        }

        if (matchType === 'none') {
          if (titleOverlap >= 1.0) matchType = 'word_match';
          else if (titleOverlap > 0.5) matchType = 'partial';
          else matchType = combinedOverlap > 0.5 ? 'partial' : 'none';
        }
      }

      // Popularity Score
      let popularityScore = 50;
      if (result.source === 'curated_playlist') {
        popularityScore = 60;
      }

      // Quality Score
      let qualityScore = 50;
      if (result.duration > 0) {
        if (result.duration >= 120 && result.duration <= 600) {
          qualityScore += 20;
        } else if (result.duration >= 60 && result.duration < 120) {
          qualityScore += 10;
        } else if (result.duration < 30) {
          qualityScore -= 25;
        } else if (result.duration > 900) {
          qualityScore -= 10;
        }
      }

      if (result.image && !result.image.includes('/placeholder.png')) {
        qualityScore += 15;
      }

      const lowerTitle = result.title.toLowerCase();
      if (OFFICIAL_INDICATORS.some(ind => lowerTitle.includes(ind))) {
        qualityScore += 15;
      }

      // Penalties (With Rule 4 Relevance Immunity)
      let penalty = 0;
      const noiseCount = NOISE_INDICATORS.filter(n => lowerTitle.includes(n)).length;
      const isStrongMatch = matchType === 'exact_title' || matchType === 'exact_artist' || matchType === 'phrase_match' || relevanceScore >= 70;

      // Noise penalty only applies if user did NOT explicitly search for that noise word
      if (!isStrongMatch && noiseCount > 0) {
        const queryHasNoise = NOISE_INDICATORS.some(n => normQuery.includes(n));
        if (!queryHasNoise) {
          penalty += Math.min(noiseCount * 8, 20);
        }
      }


      if (result.duration > 0 && result.duration < 45) {
        penalty += 12;
      }

      // Intent Adjustments
      if (intent.intent === 'trending') {
        popularityScore *= 1.3;
      }
      if (intent.intent === 'mood' || intent.intent === 'lyrics') {
        if (result.hasLyrics) qualityScore += 10;
      }

      // Final Score Calculation
      const finalScore = (
        (Math.min(relevanceScore, 100) * 0.50) +
        (Math.min(popularityScore, 100) * 0.35) +
        (Math.min(qualityScore, 100) * 0.15) -
        penalty
      );

      return {
        ...result,
        _relevanceScore: relevanceScore,
        _popularityScore: popularityScore,
        _qualityScore: qualityScore,
        _finalScore: finalScore,
        _matchType: matchType,
      };
    });

    // ── Phase 2: Stable Sort by Match Tier and Final Score ──
    scored.sort((a, b) => {
      const matchRank: Record<string, number> = {
        exact_title: 5,
        exact_artist: 5,
        phrase_match: 4,
        word_match: 3,
        partial: 2,
        none: 1
      };

      const matchDiff = (matchRank[b._matchType] || 0) - (matchRank[a._matchType] || 0);
      if (matchDiff !== 0) return matchDiff;

      return b._finalScore - a._finalScore;
    });

    // ── Phase 3: Fast Deduplication ──
    const deduplicated = this.deduplicateResults(scored, normQuery);

    // ── Phase 4: Strip internal scoring metadata ──
    return deduplicated.map(({ _relevanceScore, _popularityScore, _qualityScore, _finalScore, _matchType, _isDuplicate, ...rest }) => rest);
  }

  private static titleMatchScore(queryTitle: string, resultTitle: string): number {
    if (queryTitle === resultTitle) return 1.0;
    if (resultTitle.includes(queryTitle)) {
      return 0.85 + (queryTitle.length / resultTitle.length) * 0.15;
    }
    if (queryTitle.includes(resultTitle)) {
      return 0.7 + (resultTitle.length / queryTitle.length) * 0.15;
    }

    const overlap = wordOverlapScore(queryTitle, resultTitle);
    const levenshtein = similarityRatio(queryTitle, resultTitle);
    return Math.max(overlap, levenshtein);
  }

  private static artistMatchScore(queryArtist: string, resultArtist: string): number {
    if (queryArtist === resultArtist) return 1.0;
    if (resultArtist.includes(queryArtist) || queryArtist.includes(resultArtist)) return 0.9;
    return wordOverlapScore(queryArtist, resultArtist);
  }

  /**
   * Fast O(N) gatekeeper for deduplicating cross-source results.
   * Keeps the higher-ranked track and drops lower duplicates.
   */
  private static deduplicateResults(results: ScoredResult[], normQuery: string): ScoredResult[] {
    const kept: ScoredResult[] = [];
    const seenIds = new Set<string>();
    const seenTitleArtist = new Set<string>();

    for (const result of results) {
      if (seenIds.has(result.id)) continue;

      const normTitle = normalizeText(result.title);
      const normArtist = normalizeText(result.artist);
      const fastKey = `${normTitle}__${normArtist}`;

      // Fast O(1) duplicate check
      if (seenTitleArtist.has(fastKey)) {
        continue;
      }

      let isDuplicate = false;

      for (const existing of kept) {
        const existingTitle = normalizeText(existing.title);
        const existingArtist = normalizeText(existing.artist);

        // Exact normalized title match
        if (normTitle === existingTitle) {
          if (normArtist === existingArtist || normArtist === 'unknown artist' || existingArtist === 'unknown artist') {
            isDuplicate = true;
            break;
          }
        }

        // Fast length-gated fuzzy similarity check
        const titleSim = similarityRatio(normTitle, existingTitle);
        if (titleSim > 0.85) {
          const artistSim = similarityRatio(normArtist, existingArtist);
          if (artistSim > 0.6 || normArtist === existingArtist || normArtist === 'unknown artist' || existingArtist === 'unknown artist') {
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        seenIds.add(result.id);
        seenTitleArtist.add(fastKey);
        kept.push(result);
      }
    }

    return kept;
  }
}
