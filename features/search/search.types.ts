import { Song } from '@/lib/types';

export interface SearchState {
  query: string;
  results: { artists: any[], playlists: any[], songs: Song[], intent?: any };
  loading: boolean;
  page: number;
  hasMore: boolean;
  searchHistory: Song[];
  suggestions: any[];
  showSuggestions: boolean;
}

export interface SearchActions {
  setQuery: (q: string) => void;
  handleQueryChange: (q: string) => void;
  commitSearch: (q: string) => void;
  clearSearch: () => void;
  clearHistory: () => void;
  handlePlay: (song: Song, index?: number) => void;
  handleBack: () => void;
  loadMore: () => void;
  selectSuggestion: (item: any) => void;
  setShowSuggestions: (show: boolean) => void;
}
