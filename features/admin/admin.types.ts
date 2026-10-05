import { Song, CuratedPlaylist } from '@/lib/types';
import { BugReport } from '@/features/bug-report/bug-report.types';

export type UserFilterType = 'all' | 'active' | 'pro' | 'power' | 'banned';
export type UserSortType = 'plays' | 'today' | 'streak' | 'recent' | 'name';

export interface AdminState {
  globalSongs: Song[];
  users: any[];
  curatedPlaylists: CuratedPlaylist[];
  bugReports: BugReportWithId[];
  subscriptionRequests: any[];
  loading: boolean;
  error: string | null;
  activeTab: 'users' | 'playlists' | 'globalSongs' | 'bugReports' | 'userManagement' | 'subscriptionRequests' | 'notifications';
  fontSize: 'small' | 'normal' | 'large';
  userFilter: UserFilterType;
  userSort: UserSortType;
  userSearchQuery: string;
  selectedUser: any | null;
  drawerData: {
    playlistsCount: number | null;
    likesCount: number | null;
    playlists: any[];
    likedSongs: Song[];
    loading: boolean;
  };
}

export interface BugReportWithId extends BugReport {
  id: string;
  resolved?: boolean;
  resolvedAt?: any;
  reporterUid?: string; // UID of the user who reported (for notifications)
}

export interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  variant: 'danger' | 'info';
}

export interface ProGrantModalConfig {
  isOpen: boolean;
  targetUser: { uid: string; displayName?: string; email?: string } | null;
}

export interface AdminNotification {
  id?: string;
  targetUserId: string;
  targetUserName?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'bug_resolved';
  read: boolean;
  createdAt: any;
  sentBy: string;
}
