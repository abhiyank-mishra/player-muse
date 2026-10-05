export interface Song {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string[]; // High-res images [50x50, 150x150, 500x500]
  url: string; // Stream URL
  duration: number; // in seconds
  has_lyrics: string;
  language: string;
  year: string;
  release_date: string;
  source?: 'youtube' | string;
  type?: string;
  playback_count?: number;
  likes_count?: number;
  reposts_count?: number;
  comment_count?: number;
  play_count?: number;
  nativeRank?: number;
}

export interface Playlist {
  id: string;
  name: string;
  subtitle?: string;
  image: string;
  type: string;
  songs?: Song[];
}

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  image: string;
  perma_url: string;
  more_info: any;
}

export interface PlayerState {
  isPlaying: boolean;
  currentSong: Song | null;
  volume: number;
  seek: number;
  duration: number;
  queue: Song[];
  manualQueue: Song[];
  currentIndex: number;
  isBuffering: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'one' | 'all';
  history: Song[];
}

export interface CuratedPlaylist {
  id: string;
  name: string;
  description?: string;
  keywords: string[]; // Search keywords like ["holi", "festival", "colors"]
  spotifyPlaylistId?: string; // Source Spotify playlist if imported
  coverImage: string;
  songs: Song[];
  createdBy: string; // Admin email
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  isActive: boolean; // Show/hide in search
  priority: number; // Higher number = shows first
}
