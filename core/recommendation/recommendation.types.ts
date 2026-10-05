import { Song } from '@/lib/types';

export interface UserProfile {
  topArtists: string[];
  dominantMood: string | null;
  dominantLanguage: string | null;
  avgDuration: number;
}

export interface RecommendationFactors {
  globalTrend: number;
  userAffinity: number;
  sessionMood: number;
  languageMatch: number;
  freshness: number;
}

export interface RankedRecommendation extends Song {
  _recommendationScore?: number;
}
