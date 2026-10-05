import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, limit, getDocs, updateDoc, doc, deleteDoc, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { AdminState, BugReportWithId, ModalConfig, ProGrantModalConfig, AdminNotification, UserFilterType, UserSortType } from './admin.types';
import { grantProSubscription, revokeProSubscription } from '@/lib/subscription';
import { getGlobalExplorer, toggleGlobalPin } from '@/lib/ranking';
import { updateUserDisplayName } from '@/lib/users';
import { getCuratedPlaylists, deleteCuratedPlaylist } from '@/lib/curatedPlaylists';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { Song } from '@/lib/types';

export function useAdminLogic() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [state, setState] = useState<AdminState>({
    globalSongs: [],
    users: [],
    curatedPlaylists: [],
    bugReports: [],
    subscriptionRequests: [],
    loading: true,
    error: null,
    activeTab: 'users',
    fontSize: 'normal',
    userFilter: 'all',
    userSort: 'plays',
    userSearchQuery: '',
    selectedUser: null,
    drawerData: {
      playlistsCount: null,
      likesCount: null,
      playlists: [],
      likedSongs: [],
      loading: false,
    },
  });

  const [confirmConfig, setConfirmConfig] = useState<ModalConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger',
  });

  const [proGrantModal, setProGrantModal] = useState<ProGrantModalConfig>({
    isOpen: false,
    targetUser: null,
  });

  // --- Notification composing state ---
  const [notifTargetUid, setNotifTargetUid] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'success' | 'warning'>('info');
  const [notifSending, setNotifSending] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, authLoading, router]);

  // Font size persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_font_size') as AdminState['fontSize'] | null;
      if (saved && ['small', 'normal', 'large'].includes(saved)) {
        setState(prev => ({ ...prev, fontSize: saved }));
      }
    }
  }, []);

  const setFontSize = (size: AdminState['fontSize']) => {
    setState(prev => ({ ...prev, fontSize: size }));
    try { localStorage.setItem('admin_font_size', size); } catch {}
  };

  const loadData = useCallback(async () => {
    try {
      // Users (fetch up to 500 users)
      const qUsers = query(collection(db, 'users'), limit(500));
      const usersSnap = await getDocs(qUsers);
      const fetchedUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Auto-expire any pro users whose subscription has passed
      for (const u of fetchedUsers as any[]) {
        if (u.role === 'pro' && u.pro_expiry_date) {
          const expiry = u.pro_expiry_date as any;
          const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
          if (expiryDate < new Date()) {
            try {
              await revokeProSubscription(u.uid);
              u.role = 'normal';
              u.pro_expiry_date = null;
            } catch (e) {
              console.warn('Failed to auto-expire pro for', u.uid, e);
            }
          }
        }
      }

      // Global Songs
      const fetchedSongs = await getGlobalExplorer();

      // Playlists
      const fetchedPlaylists = await getCuratedPlaylists();

      // Bug Reports (latest 50)
      const qBugs = query(collection(db, 'bugReports'), orderBy('createdAt', 'desc'), limit(50));
      const bugsSnap = await getDocs(qBugs);
      const fetchedBugs = bugsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as BugReportWithId[];

      // Subscription Requests
      const qReqs = query(collection(db, 'subscriptionRequests'), orderBy('createdAt', 'desc'), limit(50));
      const reqsSnap = await getDocs(qReqs);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const fetchedReqs = reqsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((req: any) => {
          if (req.status === 'pending') return true;
          const createdMs = req.createdAt?.toDate?.()?.getTime() || 0;
          return createdMs > sevenDaysAgo;
        });

      setState(prev => ({
        ...prev,
        users: fetchedUsers,
        globalSongs: fetchedSongs,
        curatedPlaylists: fetchedPlaylists,
        bugReports: fetchedBugs,
        subscriptionRequests: fetchedReqs,
        loading: false,
        error: null,
      }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      loadData();
    }
  }, [isAdmin, loadData]);

  const setActiveTab = (tab: AdminState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  const setUserFilter = (filter: UserFilterType) => {
    setState(prev => ({ ...prev, userFilter: filter }));
  };

  const setUserSort = (sort: UserSortType) => {
    setState(prev => ({ ...prev, userSort: sort }));
  };

  const setUserSearchQuery = (queryText: string) => {
    setState(prev => ({ ...prev, userSearchQuery: queryText }));
  };

  const openUserDrawer = async (targetUser: any) => {
    setState(prev => ({
      ...prev,
      selectedUser: targetUser,
      drawerData: {
        playlistsCount: null,
        likesCount: null,
        playlists: [],
        likedSongs: [],
        loading: true,
      },
    }));

    try {
      const playlistsSnap = await getDocs(collection(db, 'users', targetUser.uid, 'playlists'));
      const likesSnap = await getDocs(collection(db, 'users', targetUser.uid, 'likes'));
      
      const playlists = playlistsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const likedSongs = likesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Song));

      setState(prev => ({
        ...prev,
        drawerData: {
          playlistsCount: playlists.length,
          likesCount: likedSongs.length,
          playlists,
          likedSongs,
          loading: false,
        },
      }));
    } catch {
      setState(prev => ({
        ...prev,
        drawerData: {
          playlistsCount: 0,
          likesCount: 0,
          playlists: [],
          likedSongs: [],
          loading: false,
        },
      }));
    }
  };

  const closeUserDrawer = () => {
    setState(prev => ({ ...prev, selectedUser: null }));
  };

  const closeModal = () => {
    setConfirmConfig(p => ({ ...p, isOpen: false }));
  };

  const openProModal = (targetUser: { uid: string; displayName?: string; email?: string }) => {
    setProGrantModal({ isOpen: true, targetUser });
  };

  const closeProModal = () => {
    setProGrantModal({ isOpen: false, targetUser: null });
  };

  const handleGrantPro = async (targetUid: string, days: number, message: string) => {
    if (!user || !isAdmin) return;
    try {
      await grantProSubscription(targetUid, days, message, user.displayName || user.email || 'Admin');
      await loadData();
      setState(prev => {
        if (prev.selectedUser?.uid === targetUid) {
          return { ...prev, selectedUser: { ...prev.selectedUser, role: 'pro' } };
        }
        return prev;
      });
      showToast(`Pro granted for ${days} days`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to grant Pro', 'error');
    }
  };

  const handleRevokePro = (targetUid: string, userName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Revoke Pro',
      message: `Remove Pro subscription from ${userName}?`,
      variant: 'danger',
      onConfirm: async () => {
        if (!user || !isAdmin) return;
        try {
          await revokeProSubscription(targetUid);
          await loadData();
          setState(prev => {
            if (prev.selectedUser?.uid === targetUid) {
              return { ...prev, selectedUser: { ...prev.selectedUser, role: 'normal', pro_expiry_date: null } };
            }
            return prev;
          });
          showToast('Pro subscription revoked', 'info');
        } catch (e: any) {
          showToast('Failed to revoke Pro: ' + e.message, 'error');
        }
        closeModal();
      },
    });
  };

  const handleUnpin = (song: Song) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Remove Song',
      message: `Remove ${song.name} from Global Explorer?`,
      variant: 'danger',
      onConfirm: async () => {
        await toggleGlobalPin(song);
        await loadData();
        closeModal();
        showToast('Song removed', 'info');
      },
    });
  };

  const handleBlockToggle = (targetUid: string, currentStatus: boolean, userName: string) => {
    const action = currentStatus ? 'Unblock' : 'Block';
    setConfirmConfig({
      isOpen: true,
      title: `${action} User`,
      message: `Are you sure you want to ${action.toLowerCase()} ${userName}?`,
      variant: currentStatus ? 'info' : 'danger',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', targetUid), { isBlocked: !currentStatus });
          setState(prev => ({
            ...prev,
            users: prev.users.map(u => (u.uid === targetUid ? { ...u, isBlocked: !currentStatus } : u)),
            selectedUser: prev.selectedUser?.uid === targetUid ? { ...prev.selectedUser, isBlocked: !currentStatus } : prev.selectedUser,
          }));
          showToast(`User ${currentStatus ? 'unblocked' : 'blocked'}`, 'success');
        } catch {
          showToast('Failed to update user status', 'error');
        }
        closeModal();
      },
    });
  };

  const handleEditName = (targetUid: string, currentName: string) => {
    const newName = window.prompt('Enter new display name:', currentName);
    if (newName === null || newName.trim() === '' || newName === currentName) return;

    setConfirmConfig({
      isOpen: true,
      title: 'Update Name',
      message: `Change name to "${newName.trim()}"?`,
      variant: 'info',
      onConfirm: async () => {
        try {
          await updateUserDisplayName(targetUid, newName.trim());
          setState(prev => ({
            ...prev,
            users: prev.users.map(u => u.uid === targetUid ? { ...u, name: newName.trim() } : u),
            selectedUser: prev.selectedUser?.uid === targetUid ? { ...prev.selectedUser, name: newName.trim() } : prev.selectedUser,
          }));
          showToast('Name updated', 'success');
        } catch (e: any) {
          showToast('Failed to update name: ' + e.message, 'error');
        }
        closeModal();
      }
    });
  };

  const handleApproveRequest = async (request: any) => {
     if (!user || !isAdmin) return;
     try {
       const days = request.plan === '7days' ? 7 : 30;
       await grantProSubscription(request.userId, days, 'Payment Verified', 'Self Purchase');
       await updateDoc(doc(db, 'subscriptionRequests', request.id), { status: 'approved' });
       showToast(`Subscription approved for ${request.emailPrefix || request.email}`, 'success');
       await loadData();
     } catch (e: any) {
       showToast('Approval failed: ' + e.message, 'error');
     }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'subscriptionRequests', requestId), { status: 'rejected' });
      showToast('Request rejected', 'info');
      await loadData();
    } catch {
      showToast('Rejection failed', 'error');
    }
  };

  const handleDeletePlaylist = (playlistId: string, playlistName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Playlist',
      message: `Delete playlist "${playlistName}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCuratedPlaylist(playlistId);
          await loadData();
          showToast('Playlist deleted', 'success');
        } catch {
          showToast('Failed to delete playlist', 'error');
        }
        closeModal();
      },
    });
  };

  const handleDeleteBugReport = (reportId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Report',
      message: 'Delete this bug report? Cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'bugReports', reportId));
          setState(prev => ({
            ...prev,
            bugReports: prev.bugReports.filter(b => b.id !== reportId),
          }));
          showToast('Report deleted', 'success');
        } catch {
          showToast('Failed to delete report', 'error');
        }
        closeModal();
      },
    });
  };

  // === Bug resolution: auto-remove from list + notify reporter ===
  const handleResolveBugReport = async (reportId: string, currentStatus: boolean) => {
    try {
      const newResolved = !currentStatus;
      await updateDoc(doc(db, 'bugReports', reportId), { 
        resolved: newResolved,
        resolvedAt: newResolved ? serverTimestamp() : null 
      });

      if (newResolved) {
        const bug = state.bugReports.find(b => b.id === reportId);
        
        if (bug?.reporterUid) {
          await sendNotificationToUser(
            bug.reporterUid,
            bug.userId || 'User',
            'Bug Resolved',
            bug.comment 
              ? `Your report "${bug.comment.slice(0, 50)}${bug.comment.length > 50 ? '...' : ''}" has been resolved. Thank you!`
              : 'A bug you reported has been fixed. Thank you for helping us improve Muse.',
            'bug_resolved'
          );
        }

        setState(prev => ({
          ...prev,
          bugReports: prev.bugReports.filter(b => b.id !== reportId),
        }));
        showToast('Bug resolved and user notified', 'success');
      } else {
        setState(prev => ({
          ...prev,
          bugReports: prev.bugReports.map(b => (b.id === reportId ? { ...b, resolved: false } : b)),
        }));
        showToast('Report marked as unresolved', 'info');
      }
    } catch {
      showToast('Action failed', 'error');
    }
  };

  // === Send a notification to a specific user ===
  const sendNotificationToUser = async (
    targetUid: string, 
    targetName: string,
    title: string, 
    message: string, 
    type: AdminNotification['type'] = 'info'
  ) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        targetUserId: targetUid,
        targetUserName: targetName,
        title,
        message,
        type,
        read: false,
        createdAt: serverTimestamp(),
        sentBy: user?.displayName || user?.email || 'Admin',
      });

      try {
        await fetch('/api/admin/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: targetUid,
            title,
            body: message,
            adminEmail: user?.email,
            data: { type, url: '/' },
          }),
        });
      } catch (pushErr) {
        console.warn('[Admin] Push notification failed:', pushErr);
      }
    } catch (e) {
      console.error('Failed to send notification:', e);
      throw e;
    }
  };

  // === Admin: send custom notification ===
  const handleSendNotification = async () => {
    if (!notifTargetUid || !notifTitle.trim() || !notifMessage.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setNotifSending(true);
    try {
      const targetUser = state.users.find(u => u.uid === notifTargetUid);
      await sendNotificationToUser(
        notifTargetUid,
        targetUser?.name || targetUser?.displayName || 'User',
        notifTitle.trim(),
        notifMessage.trim(),
        notifType
      );
      showToast('Notification sent', 'success');
      setNotifTitle('');
      setNotifMessage('');
      setNotifTargetUid('');
    } catch (e: any) {
      showToast('Failed to send notification: ' + e.message, 'error');
    } finally {
      setNotifSending(false);
    }
  };

  // === Send notification to ALL users ===
  const handleSendToAll = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      showToast('Please fill in title and message', 'error');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Broadcast',
      message: `Send this notification to all ${state.users.length} users?`,
      variant: 'info',
      onConfirm: async () => {
        setNotifSending(true);
        try {
          const batch: Promise<any>[] = [];
          for (const u of state.users) {
            if (u.uid) {
              batch.push(
                addDoc(collection(db, 'notifications'), {
                  targetUserId: u.uid,
                  targetUserName: u.name || u.displayName || 'User',
                  title: notifTitle.trim(),
                  message: notifMessage.trim(),
                  type: notifType,
                  read: false,
                  createdAt: serverTimestamp(),
                  sentBy: user?.displayName || user?.email || 'Admin',
                })
              );
            }
          }
          await Promise.all(batch);

          try {
            await fetch('/api/admin/send-push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: notifTitle.trim(),
                body: notifMessage.trim(),
                adminEmail: user?.email,
                data: { type: notifType, url: '/' },
              }),
            });
          } catch (pushErr) {
            console.warn('[Admin] Bulk push failed:', pushErr);
          }

          showToast(`Broadcast sent to ${batch.length} users`, 'success');
          setNotifTitle('');
          setNotifMessage('');
        } catch (e: any) {
          showToast('Bulk send failed: ' + e.message, 'error');
        } finally {
          setNotifSending(false);
        }
        closeModal();
      }
    });
  };

  // Computed metrics for Command Center cards
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let activeTodayCount = 0;
    let totalPlaysToday = 0;
    let proCount = 0;

    for (const u of state.users) {
      if (u.playStats?.date === today && (u.playStats?.count || 0) > 0) {
        activeTodayCount++;
        totalPlaysToday += u.playStats.count || 0;
      }
      if (u.role === 'pro') {
        proCount++;
      }
    }

    const pendingRequestsCount = state.subscriptionRequests.filter((r: any) => r.status === 'pending').length;
    const openBugsCount = state.bugReports.filter((b: any) => !b.resolved).length;

    return {
      totalUsers: state.users.length,
      activeTodayCount,
      totalPlaysToday,
      proCount,
      pendingRequestsCount,
      openBugsCount,
    };
  }, [state.users, state.subscriptionRequests, state.bugReports]);

  return {
    state,
    isAdmin,
    authLoading,
    confirmConfig,
    proGrantModal,
    metrics,
    setActiveTab,
    setUserFilter,
    setUserSort,
    setUserSearchQuery,
    openUserDrawer,
    closeUserDrawer,
    closeModal,
    openProModal,
    closeProModal,
    handleGrantPro,
    handleRevokePro,
    handleUnpin,
    handleBlockToggle,
    handleDeletePlaylist,
    handleDeleteBugReport,
    handleResolveBugReport,
    handleEditName,
    handleApproveRequest,
    handleRejectRequest,
    // Notification system
    notifTargetUid, setNotifTargetUid,
    notifTitle, setNotifTitle,
    notifMessage, setNotifMessage,
    notifType, setNotifType,
    notifSending,
    handleSendNotification,
    handleSendToAll,
    sendNotificationToUser,
    // Font size
    setFontSize,
  };
}
