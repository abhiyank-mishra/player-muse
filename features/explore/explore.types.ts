import { Song } from '@/lib/types';
import { User } from 'firebase/auth';

export interface ExploreState {
  songs: Song[];
  loading: boolean;
  error: string | null;
  isReady: boolean;
  currentSong: Song | null;
  user: User | null;
}

export interface ExploreActions {
  handleStartExplorer: () => void;
  handleBack: () => void;
  loadMore: () => void;
  togglePlay: () => void;
  setQueueConfig: (songs: Song[], index: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}
