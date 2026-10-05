import { Song } from '@/lib/types';
import { User } from 'firebase/auth';

export interface FavoritesState {
  user: User | null;
  authLoading: boolean;
  songs: Song[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
}

export interface FavoritesActions {
  loadFavorites: (isLoadMore?: boolean) => void;
  handlePlay: (song: Song, index: number) => void;
  handlePlayAll: (shuffle: boolean, shuffledSongs?: Song[]) => void;
  login: () => void;
}
