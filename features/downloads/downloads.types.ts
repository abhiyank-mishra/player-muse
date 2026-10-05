import { Song } from '@/lib/types';
import { DownloadedPlaylist } from '@/lib/offlineStorage';
import { User } from 'firebase/auth';

export interface DownloadedSongItem {
  song: Song;
  downloadedAt: number;
  size: number;
  playlistId?: string;
}

export interface DownloadsState {
  user: User | null;
  authLoading: boolean;
  allSongs: DownloadedSongItem[];
  playlists: DownloadedPlaylist[];
  stats: { totalSize: number; count: number };
  browserQuota: { usage: number; quota: number } | null;
  displayedCount: number;
  isLoadingMore: boolean;
  viewPlaylistId: string | null;
  isOnline: boolean;
  confirmConfig: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  };
  currentSong: Song | null;
  isPlaying: boolean;
}

export interface DownloadsActions {
  setViewPlaylistId: (id: string | null) => void;
  loadMore: () => void;
  handleDeleteSong: (songId: string) => void;
  handleDeletePlaylist: (playlistId: string, e: React.MouseEvent) => void;
  handlePlayQueue: (index: number) => void;
  handlePlayAll: (shuffle: boolean) => void;
  closeConfirm: () => void;
  playNext: (song: Song) => void;
  handleRenamePlaylist: (playlistId: string, newName: string) => void;
}
