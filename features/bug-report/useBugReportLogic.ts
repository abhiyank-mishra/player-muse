import { useState, useCallback, useEffect } from 'react';
import ErrorCollector from '@/core/error/ErrorCollector';
import { BugReport } from './bug-report.types';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/contexts/ToastContext';
import { useShakeDetector } from '@/platform/mobile/useShakeDetector';

export const MAX_REPORTS_PER_SESSION = 3;

/**
 * Compresses a string by trimming, collapsing whitespace, and truncating to a max length.
 */
function compressString(str: string, maxLen: number): string {
  return str
    .replace(/\s+/g, ' ')     // collapse multiple whitespace to single space
    .trim()
    .slice(0, maxLen);
}

/**
 * Compresses error logs to reduce payload size:
 * - Keep only the last 15 most recent logs (not 50)
 * - Truncate long messages
 * - Remove redundant fields
 */
function compressLogs(logs: any[]): any[] {
  return logs
    .slice(-15) // keep only most recent 15
    .map(log => ({
      type: log.type,
      message: compressString(String(log.message || ''), 300), // cap message at 300 chars
      timestamp: log.timestamp,
      // Only include source/line info for actual errors (not console.log)
      ...(log.type === 'window.onerror' || log.type === 'unhandledrejection'
        ? { source: log.source, lineno: log.lineno }
        : {}
      ),
    }));
}

export function useBugReportLogic() {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const pathname = usePathname();
  const { user } = useAuth();
  const { currentSong, isPlaying } = usePlayer();
  const { showToast } = useToast();

  const openBugReport = useCallback(() => {
    // Block in offline mode
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Bug reports are not available offline.', 'error');
      return;
    }

    const sessionReports = parseInt(sessionStorage.getItem('bugReportsCount') || '0', 10);
    if (sessionReports >= MAX_REPORTS_PER_SESSION) {
      showToast('Wait! You have already submitted too many bug reports this session.', 'error');
      return;
    }
    setIsOpen(true);
  }, [showToast]);

  const closeBugReport = () => {
    setIsOpen(false);
    setComment('');
  };

  // Mount shake detector
  useShakeDetector(() => {
    if (!isOpen) {
      openBugReport();
    }
  });

  const handleSubmit = async () => {
    // Double-check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Cannot submit bug report while offline.', 'error');
      return;
    }

    const sessionReports = parseInt(sessionStorage.getItem('bugReportsCount') || '0', 10);
    if (sessionReports >= MAX_REPORTS_PER_SESSION) {
        showToast('Submission limit reached.', 'error');
        return;
    }

    setIsSubmitting(true);
    try {
      // Build report payload
      const device = typeof window !== 'undefined' ? navigator.userAgent : 'Unknown';
      const isIOS = /iPad|iPhone|iPod/.test(device);
      const isAndroid = /Android/.test(device);
      const platform = isIOS ? 'iOS' : (isAndroid ? 'Android' : 'Desktop');

      // Compress the payload
      const rawLogs = ErrorCollector.getLogs();
      const compressedLogs = compressLogs(rawLogs);

      // Compress current song — only send essential fields
      const songSummary = currentSong ? {
        id: currentSong.id,
        name: currentSong.name,
        artist: currentSong.artist,
        source: currentSong.source,
      } : null;

      const payload: any = {
        userId: user ? (user.displayName || user.email || user.uid) : 'Anonymous',
        reporterUid: user?.uid || null, // For sending notifications back to reporter
        timestamp: new Date().toISOString(),
        platform,
        device: compressString(device, 200), // Trim very long UAs
        currentRoute: pathname || 'Unknown',
        currentSong: songSummary,
        errorLogs: compressedLogs,
        playerState: {
          isPlaying,
          songId: currentSong?.id || null,
        },
        comment: compressString(comment, 500), // Cap user comment at 500 chars
        appVersion: 'v0.1.0'
      };

      const res = await fetch('/api/admin/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to submit bug report');
      }

      showToast('Bug reported successfully! Thank you.', 'success');
      sessionStorage.setItem('bugReportsCount', (sessionReports + 1).toString());
      ErrorCollector.clearLogs(); // Optional: clear after submit
      closeBugReport();
    } catch (error) {
       console.error(error);
       showToast('Failed to submit bug report.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isOpen,
    isSubmitting,
    comment,
    setComment,
    openBugReport,
    closeBugReport,
    handleSubmit
  };
}
