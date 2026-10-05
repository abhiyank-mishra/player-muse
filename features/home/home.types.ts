import { Song } from '@/lib/types';
import { User } from 'firebase/auth';
import { ReadonlyURLSearchParams } from 'next/navigation';

export interface HomeState {
  user: User | null;
  userName: string | null;
  searchParams: ReadonlyURLSearchParams;
  query: string;
  results: Song[];
  communityTrending: Song[];
  hasMore: boolean;
  loadingMore: boolean;
  globalExplorer: Song[];
  allDiscoverSongs: readonly Song[];
  discoverPage: number;
  loading: boolean;
  showSuggestions: boolean;
  dailyPlays: number;
  streak: number;
  madeForYou: Song[];
  madeForYouPersonalized: boolean;
}

export interface HomeActions {
  setQuery: (q: string) => void;
  resetSearch: () => void;
  loadCommunityTrending: (isLoadMore?: boolean) => void;
  loadMoreDiscover: () => void;
  handleSuggestionClick: (s: any) => void;
  handlePlayAll: () => void;
  toggleSidebar: () => void;
  setQueueConfig: (songs: Song[], index: number) => void;
  playSong: (song: Song, sourceContext?: string) => void;
  searchMusic: (q: string) => void;
}
