export interface BugReport {
  userId: string;
  timestamp: string;
  platform: string;
  device: string;
  currentRoute: string;
  currentSong: any;
  errorLogs: any[];
  playerState: any;
  comment: string;
  appVersion: string;
}

export interface ErrorLog {
  type: string;
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: any;
  timestamp: string;
}
