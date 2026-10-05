export interface TestSearchState {
  query: string;
  results: {
    artists: any[];
    playlists: any[];
    songs: any[];
  };
  loading: boolean;
  error: string | null;
}

export interface TestSearchActions {
  setQuery: (query: string) => void;
  search: (query: string) => void;
}
