import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  Trash2, 
  ArrowLeft, 
  Users, 
  Ban, 
  CheckCircle, 
  Plus, 
  Edit, 
  Bug, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Crown, 
  UserX, 
  Zap, 
  Clock, 
  Bell, 
  Send, 
  Type, 
  Radio, 
  ListMusic, 
  Search,
  Activity,
  Smartphone,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import SongCard from '@/components/SongCard';
import ConfirmModal from '@/reusable/ui/modals/ConfirmModal';
import ProGrantModal from './ProGrantModal';
import { UserDrawer } from './UserDrawer';
import { useToast } from '@/contexts/ToastContext';
import { UserFilterType, UserSortType } from './admin.types';

const FONT_SIZES = {
  small: { base: 'text-[11px]', sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg' },
  normal: { base: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' },
  large: { base: 'text-sm', sm: 'text-base', md: 'text-lg', lg: 'text-xl', xl: 'text-2xl' },
};

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

const NOTIF_TEMPLATES = [
  { label: 'Welcome', title: 'Welcome to Muse', body: 'Enjoy uninterrupted music streaming on Muse.' },
  { label: 'Pro Gift', title: 'Pro Activated', body: 'You have been granted Pro access. Enjoy premium features!' },
  { label: 'Update', title: 'New Update', body: 'New features and improvements are now live on Muse.' },
  { label: 'Reminder', title: 'Pro Expiring', body: 'Your Pro subscription is expiring soon. Renew to keep your perks.' },
];

export function AdminUI({
  state,
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
  // Notifications
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
}: any) {
  const [expandedBug, setExpandedBug] = useState<string | null>(null);
  const { showToast } = useToast();
  const fs = FONT_SIZES[state.fontSize as keyof typeof FONT_SIZES] || FONT_SIZES.normal;

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter & Sort Users
  const filteredUsers = useMemo(() => {
    let list = [...(state.users || [])];

    // Filter pill
    if (state.userFilter === 'active') {
      list = list.filter((u: any) => u.playStats?.date === today && (u.playStats?.count || 0) > 0);
    } else if (state.userFilter === 'pro') {
      list = list.filter((u: any) => u.role === 'pro' || u.email === ADMIN_EMAIL);
    } else if (state.userFilter === 'power') {
      list = list.filter((u: any) => (u.totalPlays || u.playStats?.count || 0) >= 30);
    } else if (state.userFilter === 'banned') {
      list = list.filter((u: any) => u.isBlocked);
    }

    // Search query
    if (state.userSearchQuery) {
      const q = state.userSearchQuery.toLowerCase();
      list = list.filter((u: any) => {
        const name = (u.name || u.displayName || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const uid = (u.uid || '').toLowerCase();
        return name.includes(q) || email.includes(q) || uid.includes(q);
      });
    }

    // Sort
    list.sort((a: any, b: any) => {
      if (state.userSort === 'today') {
        const aToday = a.playStats?.date === today ? (a.playStats?.count || 0) : 0;
        const bToday = b.playStats?.date === today ? (b.playStats?.count || 0) : 0;
        return bToday - aToday;
      }
      if (state.userSort === 'streak') {
        return (b.playStats?.streak || 0) - (a.playStats?.streak || 0);
      }
      if (state.userSort === 'recent') {
        const aTime = a.lastActive?.seconds || 0;
        const bTime = b.lastActive?.seconds || 0;
        return bTime - aTime;
      }
      if (state.userSort === 'name') {
        return (a.name || a.displayName || '').localeCompare(b.name || b.displayName || '');
      }
      // default: plays (lifetime or today)
      const aPlays = a.totalPlays ?? (a.playStats?.count || 0);
      const bPlays = b.totalPlays ?? (b.playStats?.count || 0);
      return bPlays - aPlays;
    });

    return list;
  }, [state.users, state.userFilter, state.userSort, state.userSearchQuery, today]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#121214]">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const { activeTab, curatedPlaylists, bugReports, error } = state;
  const activeBugs = bugReports.filter((b: any) => !b.resolved);

  return (
    <div className="min-h-screen bg-[#121214] text-zinc-100 p-3 md:p-6 max-w-7xl mx-auto pb-32">
      {/* Sticky Top Header */}
      <div className="sticky top-0 bg-[#121214]/95 backdrop-blur-md z-40 py-3 -mx-3 px-3 md:mx-0 md:px-0 border-b border-white/5 mb-5 space-y-4">
        {/* Row 1: Back + Title + Font Scale */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 text-zinc-400 hover:text-white" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-white" />
              <h1 className={`${fs.lg} md:text-xl font-bold tracking-tight text-white`}>Admin</h1>
            </div>
          </div>

          {/* Font Size Toggle */}
          <div className="flex items-center gap-1 bg-[#18181b] rounded-lg border border-white/5 p-1">
            {(['small', 'normal', 'large'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
                  state.fontSize === size
                    ? 'bg-white/15 text-white'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title={`${size} text`}
              >
                <Type className={`${size === 'small' ? 'w-3 h-3' : size === 'normal' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: KPI Metrics Cards (Short, compact, no emojis) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Card 1: Users */}
          <button
            onClick={() => { setActiveTab('users'); setUserFilter('all'); }}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTab === 'users' && state.userFilter === 'all'
                ? 'bg-white/10 border-white/20'
                : 'bg-[#18181b] border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Users</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{metrics.totalUsers}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{metrics.activeTodayCount} active</div>
          </button>

          {/* Card 2: Streams */}
          <button
            onClick={() => { setActiveTab('users'); setUserFilter('active'); setUserSort('today'); }}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTab === 'users' && state.userFilter === 'active'
                ? 'bg-white/10 border-white/20'
                : 'bg-[#18181b] border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Streams</span>
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{metrics.totalPlaysToday}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5 truncate">Today</div>
          </button>

          {/* Card 3: Pro */}
          <button
            onClick={() => { setActiveTab('subscriptionRequests'); }}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTab === 'subscriptionRequests'
                ? 'bg-white/10 border-white/20'
                : 'bg-[#18181b] border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pro</span>
              <Crown className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{metrics.proCount}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
              {metrics.pendingRequestsCount > 0 ? `${metrics.pendingRequestsCount} pending` : 'Subscribers'}
            </div>
          </button>

          {/* Card 4: Bugs */}
          <button
            onClick={() => setActiveTab('bugReports')}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTab === 'bugReports'
                ? 'bg-white/10 border-white/20'
                : 'bg-[#18181b] border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Bugs</span>
              <Bug className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{metrics.openBugsCount}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5 truncate">Open reports</div>
          </button>
        </div>

        {/* Row 3: Tab Navigation Bar (Short labels, compact controls) */}
        <div className="flex w-full overflow-x-auto hide-scrollbar gap-1.5 bg-[#18181b] p-1 rounded-xl border border-white/5">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'subscriptionRequests', label: 'Requests', icon: Zap, badge: metrics.pendingRequestsCount },
            { id: 'bugReports', label: 'Bugs', icon: Bug, badge: metrics.openBugsCount },
            { id: 'notifications', label: 'Notify', icon: Bell },
            { id: 'playlists', label: 'Playlists', icon: ListMusic },
            { id: 'globalSongs', label: 'Global', icon: Radio },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-none px-3.5 py-1.5 rounded-lg ${fs.base} font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20 text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className={`${fs.sm} font-medium`}>{error}</p>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: USERS (Master Directory + Usage Analytics)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {/* Controls: Filter Pills + Search + Sort */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-[#18181b] p-2.5 rounded-xl border border-white/5">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'pro', label: 'Pro' },
                  { id: 'power', label: 'Power' },
                  { id: 'banned', label: 'Banned' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setUserFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    state.userFilter === f.id
                      ? 'bg-white/20 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-56 flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={state.userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25 transition-colors"
                />
              </div>

              <select
                value={state.userSort}
                onChange={(e) => setUserSort(e.target.value as UserSortType)}
                className="bg-[#121214] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/25 transition-colors appearance-none cursor-pointer"
              >
                <option value="plays">Most Plays</option>
                <option value="today">Today</option>
                <option value="streak">Streak</option>
                <option value="recent">Recent</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {/* User Count Indicator */}
          <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
            <span>Showing {filteredUsers.length} users</span>
          </div>

          {/* Users List */}
          <div className="flex flex-col gap-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-xl text-zinc-500 text-xs">
                No users match the criteria.
              </div>
            ) : (
              filteredUsers.map((u: any) => {
                const isAdminUser = u.email === ADMIN_EMAIL || u.role === 'admin';
                const isPro = u.role === 'pro';
                const proExpiryDate = u.pro_expiry_date?.seconds ? new Date(u.pro_expiry_date.seconds * 1000) : null;
                const isExpired = proExpiryDate ? proExpiryDate < new Date() : false;
                const daysLeft = proExpiryDate ? Math.ceil((proExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

                const playsToday = u.playStats?.date === today ? (u.playStats?.count || 0) : 0;
                const totalPlays = u.totalPlays ?? (u.playStats?.count || 0);
                const streak = u.playStats?.streak || 0;

                const lastActiveDate = u.lastActive?.seconds ? new Date(u.lastActive.seconds * 1000) : null;
                const isOnline = lastActiveDate ? (Date.now() - lastActiveDate.getTime()) < 15 * 60 * 1000 : false;
                const lastActiveText = lastActiveDate 
                  ? lastActiveDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : 'Never';

                return (
                  <div
                    key={u.uid}
                    onClick={() => openUserDrawer(u)}
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      u.isBlocked
                        ? 'bg-red-500/5 border-red-500/30'
                        : isPro && !isExpired
                        ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                        : 'bg-[#18181b] border-white/5 hover:border-white/15'
                    }`}
                  >
                    {/* Left: Avatar + Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <img
                          src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.name || 'User')}&background=27272a&color=fff`}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#18181b]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`font-bold text-white ${fs.sm} truncate max-w-[160px] md:max-w-none`}>
                            {u.name || u.displayName || 'Unknown'}
                          </h4>
                          {isAdminUser && (
                            <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-semibold">
                              ADMIN
                            </span>
                          )}
                          {isPro && !isExpired && (
                            <span className="text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                              PRO ({daysLeft}d)
                            </span>
                          )}
                          {isPro && isExpired && (
                            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded">
                              EXP
                            </span>
                          )}
                          {u.isBlocked && (
                            <span className="text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded font-semibold">
                              BAN
                            </span>
                          )}
                        </div>
                        <p className={`${fs.base} text-zinc-400 truncate`}>{u.email || 'No email'}</p>
                      </div>
                    </div>

                    {/* Middle: Usage Metrics */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 flex items-center gap-1 whitespace-nowrap">
                        <Zap className="w-3 h-3 text-zinc-400" />
                        <span className="font-semibold text-white">{playsToday}</span> today
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 flex items-center gap-1 whitespace-nowrap">
                        <Activity className="w-3 h-3 text-zinc-400" />
                        <span className="font-semibold text-white">{totalPlays}</span> total
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 whitespace-nowrap">
                        {streak}d streak
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 hidden md:flex items-center gap-1 whitespace-nowrap">
                        <Smartphone className="w-3 h-3 text-zinc-400" />
                        {u.device || 'Web'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 hidden lg:inline whitespace-nowrap">
                        {lastActiveText}
                      </span>
                    </div>

                    {/* Right: Quick Actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!isAdminUser && (
                        <>
                          {!isPro || isExpired ? (
                            <button
                              onClick={() => openProModal({ uid: u.uid, displayName: u.displayName, email: u.email })}
                              className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap"
                            >
                              Pro
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRevokePro(u.uid, u.displayName || u.name)}
                              className="px-2 py-1 bg-white/5 hover:bg-red-500/10 text-red-300 border border-red-500/20 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap"
                            >
                              RM
                            </button>
                          )}
                          <button
                            onClick={() => handleBlockToggle(u.uid, u.isBlocked, u.displayName || u.name)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.isBlocked
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            }`}
                            title={u.isBlocked ? 'Unblock' : 'Block'}
                          >
                            {u.isBlocked ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openUserDrawer(u)}
                        className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors"
                        title="View details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SUBSCRIPTION REQUESTS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'subscriptionRequests' && (
        <div className="bg-[#18181b] rounded-2xl p-4 md:p-6 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`${fs.md} font-bold text-white flex items-center gap-2`}>
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Requests</span>
            </h2>
            <span className="text-xs font-mono text-zinc-400 bg-white/5 px-2.5 py-0.5 rounded-full">
              {state.subscriptionRequests.filter((r: any) => r.status === 'pending').length} active
            </span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[80vh] overflow-y-auto">
            {state.subscriptionRequests.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-zinc-500 text-xs">
                No subscription requests.
              </div>
            ) : (
              state.subscriptionRequests.map((req: any) => (
                <div
                  key={req.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    req.status === 'pending'
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-white/[0.02] border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/5 text-zinc-300 shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className={`font-bold text-white ${fs.sm} truncate`}>
                          {req.userName || req.emailPrefix} • <span className="text-zinc-300">{req.plan === '7days' ? '1 Week' : '1 Month'}</span>
                        </h3>
                        <p className="text-xs text-zinc-400 truncate">
                          {req.email} • ₹{req.amount} • {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleApproveRequest(req)}
                            className="px-3 py-1.5 bg-white/15 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Reject"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                          {req.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: BUG REPORTS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bugReports' && (
        <div className="bg-[#18181b] rounded-2xl p-4 md:p-6 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`${fs.md} font-bold text-white flex items-center gap-2`}>
              <Bug className="w-4 h-4 text-zinc-400" />
              <span>Bugs</span>
            </h2>
            <span className="text-xs font-mono text-zinc-400 bg-white/5 px-2.5 py-0.5 rounded-full">
              {activeBugs.length} open
            </span>
          </div>

          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[80vh]">
            {activeBugs.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-zinc-500 text-xs">
                No open bug reports.
              </div>
            ) : (
              activeBugs.map((bug: any) => (
                <div key={bug.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                  <div
                    onClick={() => setExpandedBug(expandedBug === bug.id ? null : bug.id)}
                    className="p-3.5 flex flex-col gap-2 cursor-pointer hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10 text-red-400 shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white">{bug.platform || 'Platform'}</span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-xs text-zinc-400">
                            {bug.createdAt?.seconds ? new Date(bug.createdAt.seconds * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {bug.userId || 'Anonymous'} | {bug.currentRoute || '/'}
                        </p>
                        {bug.comment && (
                          <p className="text-xs text-zinc-300 mt-1 bg-white/5 p-2 rounded-lg">"{bug.comment}"</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResolveBugReport(bug.id, bug.resolved || false); }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Resolve
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteBugReport(bug.id); }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="p-1 text-zinc-500">
                        {expandedBug === bug.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Diagnostics */}
                  {expandedBug === bug.id && (
                    <div className="p-3.5 bg-[#121214] border-t border-white/5 text-xs font-mono space-y-3">
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Device</span>
                        <p className="text-zinc-300">{bug.device || 'Unknown'}</p>
                      </div>

                      {bug.currentSong && (
                        <div>
                          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Song</span>
                          <pre className="p-2 rounded bg-black/40 text-zinc-400 whitespace-pre-wrap">{JSON.stringify(bug.currentSong, null, 2)}</pre>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Logs</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(bug.errorLogs, null, 2));
                              showToast('Logs copied', 'success');
                            }}
                            className="text-xs text-white hover:underline"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="p-2 rounded bg-black/40 text-red-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {JSON.stringify(bug.errorLogs, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: NOTIFICATIONS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="bg-[#18181b] rounded-2xl p-4 md:p-6 border border-white/5 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-400" />
            <h2 className={`${fs.md} font-bold text-white`}>Notify</h2>
          </div>

          {/* Quick Templates (No emojis) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Templates</label>
            <div className="flex gap-2 flex-wrap">
              {NOTIF_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  onClick={() => { setNotifTitle(tmpl.title); setNotifMessage(tmpl.body); }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 font-semibold border border-white/5 transition-all whitespace-nowrap"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Selection */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Recipient</label>
            <select
              value={notifTargetUid}
              onChange={(e) => setNotifTargetUid(e.target.value)}
              className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25 transition-colors appearance-none"
            >
              <option value="">Select a user...</option>
              {(state.users || [])
                .slice()
                .sort((a: any, b: any) => (a.name || a.displayName || '').localeCompare(b.name || b.displayName || ''))
                .map((u: any) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name || u.displayName || 'Unknown'} ({u.email || u.uid})
                  </option>
                ))}
            </select>
          </div>

          {/* Notification Type (Clean buttons, no emojis) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['info', 'success', 'warning'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNotifType(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                    notifType === t
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'bg-white/5 text-zinc-400 border border-transparent hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Title</label>
            <input
              type="text"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              placeholder="Notification title..."
              maxLength={100}
              className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Message</label>
            <textarea
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              placeholder="Notification body..."
              maxLength={500}
              rows={3}
              className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25 transition-colors resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              onClick={handleSendNotification}
              disabled={notifSending || !notifTargetUid}
              className="flex-1 py-2 bg-white/15 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              {notifSending ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={handleSendToAll}
              disabled={notifSending}
              className="py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-semibold rounded-xl transition-all disabled:opacity-40 whitespace-nowrap"
            >
              Broadcast
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: CURATED PLAYLISTS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'playlists' && (
        <div className="bg-[#18181b] rounded-2xl p-4 md:p-6 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`${fs.md} font-bold text-white flex items-center gap-2`}>
              <ListMusic className="w-4 h-4 text-zinc-400" />
              <span>Playlists</span>
            </h2>
            <Link
              href="/admin/curated-playlists/new"
              className="bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Create
            </Link>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[80vh]">
            {curatedPlaylists.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-zinc-500 text-xs">
                No curated playlists found.
              </div>
            ) : (
              curatedPlaylists.map((playlist: any) => (
                <div
                  key={playlist.id}
                  className="bg-white/[0.02] border border-white/5 rounded-xl p-3 hover:border-white/15 transition-all flex items-center gap-3"
                >
                  <img
                    src={playlist.coverImage || '/logo.png'}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover shrink-0 aspect-square border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-white ${fs.sm} truncate`}>{playlist.name}</h3>
                    <p className="text-xs text-zinc-400 truncate">{playlist.description || `${playlist.songs?.length || 0} tracks`}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={`/admin/curated-playlists/${playlist.id}`}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => handleDeletePlaylist(playlist.id, playlist.name)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: GLOBAL EXPLORER SONGS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'globalSongs' && (
        <div className="bg-[#18181b] rounded-2xl p-4 md:p-6 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`${fs.md} font-bold text-white flex items-center gap-2`}>
              <Radio className="w-4 h-4 text-zinc-400" />
              <span>Global Explorer</span>
            </h2>
            <span className="text-xs font-mono text-zinc-400 bg-white/5 px-2.5 py-0.5 rounded-full">
              {state.globalSongs.length} pinned
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {state.globalSongs.map((song: any) => (
              <div key={song.id} className="relative group">
                <SongCard song={song} />
                <button
                  onClick={() => handleUnpin(song)}
                  className="absolute -top-1.5 -right-1.5 p-1.5 bg-black/80 border border-white/20 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-105"
                  title="Remove from Global"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Inspection Drawer */}
      <UserDrawer
        user={state.selectedUser}
        drawerData={state.drawerData}
        fs={fs}
        onClose={closeUserDrawer}
        onGrantPro={openProModal}
        onRevokePro={handleRevokePro}
        onBlockToggle={handleBlockToggle}
        onEditName={handleEditName}
        onSendDirectMessage={sendNotificationToUser}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={closeModal}
        variant={confirmConfig.variant}
      />

      {/* Grant Pro Modal */}
      <ProGrantModal
        isOpen={proGrantModal?.isOpen ?? false}
        targetUser={proGrantModal?.targetUser ?? null}
        onConfirm={handleGrantPro}
        onClose={closeProModal}
      />
    </div>
  );
}
