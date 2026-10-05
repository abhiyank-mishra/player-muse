import { Song } from '@/lib/types';

export interface PlaylistState {
  allSongs: Song[];
  visibleSongs: Song[];
  playlistInfo: any;
  loading: boolean;
  page: number;
  hasMore: boolean;
}

export interface PlaylistActions {
  handlePlay: (song: Song, index: number) => void;
  handlePlayAll: (shuffle: boolean, shuffledSongs?: Song[]) => void;
  handleLoadMore: () => void;
}
