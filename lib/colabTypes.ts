import { Song } from './types';

export interface ColabTasteProfile {
  topArtists: string[];
  topMoods: string[];
  dominantLanguage?: string | null;
  recentSeedIds: string[];
  userName: string;
}

export interface ColabMember {
  id: string;
  name: string;
  avatar: string | null;
  isHost: boolean;
  joinedAt: number;
  lastActive: number;
  tasteProfile?: ColabTasteProfile;
}

export interface ColabQueueItem {
  song: Song;
  isManual: boolean;
  forUserName?: string;
  isBlend?: boolean;
}

export interface ColabReaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export type ColabControlMode = 'host-only' | 'collab';

export interface ColabRoom {
  id: string; // e.g. "A7K2X9"
  name: string; // "Abhiyank's Jam"
  hostId: string;
  hostName: string;
  hostAvatar: string | null;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'ended';
  controlMode: ColabControlMode;

  // Real-time Playback State
  currentSong: Song | null;
  isPlaying: boolean;
  position: number; // in seconds
  positionUpdatedAt: number; // timestamp
  lastActionBy?: string; // userId who triggered last play/pause/seek

  // Queue & Members
  queue: Song[];
  history?: Song[];
  upcomingSong?: Song | null;
  upcomingSongs?: Song[];
  dismissedUpcomingIds?: string[];
  members: Record<string, ColabMember>;
  reactions?: ColabReaction[];
}

export interface ColabContextType {
  room: ColabRoom | null;
  roomId: string | null;
  isHost: boolean;
  isMember: boolean;
  isInRoom: boolean;
  isLoading: boolean;
  authLoading: boolean;
  isColabLocked: boolean;
  error: string | null;
  floatingReactions: ColabReaction[];

  // Actions
  createRoom: (roomName?: string, controlMode?: ColabControlMode) => Promise<string | null>;
  joinRoom: (codeOrLink: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  endRoom: () => Promise<void>;
  sendReaction: (emoji: string) => Promise<void>;
  addToColabQueue: (song: Song) => Promise<void>;
  removeFromColabQueue: (index: number) => Promise<void>;
  dismissUpcomingSong: (songId: string) => Promise<void>;
  playColabSong: (song: Song) => Promise<void>;
  playNextInColabQueue: () => Promise<void>;
  playPrevInColabSong: () => Promise<void>;
  setControlMode: (mode: ColabControlMode) => Promise<void>;
  syncWithHost: () => void;
  broadcastSeek: (seconds: number) => Promise<void>;
  setPendingJoinCode: (code: string) => void;
}
