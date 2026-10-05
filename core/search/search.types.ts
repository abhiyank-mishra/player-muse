// /core/search/search.types.ts

export interface UnifiedSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  image: string;
  source: 'youtube' | 'curated_playlist';
  likes?: number;
  playback?: number;
  reposts?: number;
  comments?: number;
  hasLyrics?: boolean;
  playCount?: number;
  year?: string;
  language?: string;
  nativeRank?: number;
  
  // Keep original to return in the API
  original: any;
}

export interface QueryIntent {
  intent: 'default' | 'trending' | 'mood' | 'lyrics' | 'artist_song' | 'artist_discography';
  keywords: string[];
  // Parsed components for smarter matching
  possibleArtist?: string;
  possibleSongTitle?: string;
  isExactLookup?: boolean; // User is looking for a specific song, not browsing
}

export interface ScoredResult extends UnifiedSearchResult {
  _relevanceScore: number;
  _popularityScore: number;
  _qualityScore: number;
  _finalScore: number;
  _matchType: 'exact_title' | 'exact_artist' | 'phrase_match' | 'word_match' | 'partial' | 'none';
  _isDuplicate?: boolean;
}
