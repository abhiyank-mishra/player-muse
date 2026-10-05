"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  deleteField,
  arrayUnion 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { usePlayer } from './PlayerContext';
import { useToast } from './ToastContext';
import { ColabRoom, ColabMember, ColabReaction, ColabControlMode, ColabContextType } from '@/lib/colabTypes';
import { Song } from '@/lib/types';
import { playMemberJoinSound, playReactionPopSound } from '@/lib/colabAudio';
import { getMyTasteProfile, syncTasteProfileToRoom } from '@/lib/colabTaste';

const ColabContext = createContext<ColabContextType | undefined>(undefined);

const ROOM_STORAGE_KEY = 'muse_active_colab_room';

// Helper to generate a 6-character alphanumeric code: "A7K2X9"
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to normalize user input (supports direct code or full URL)
export function parseRoomCode(input: string): string {
  let cleaned = input.trim();
  if (cleaned.includes('room=')) {
    const match = cleaned.match(/room=([A-Za-z0-9]+)/i);
    if (match) cleaned = match[1];
  } else if (cleaned.includes('/colab/')) {
    const match = cleaned.match(/\/colab\/([A-Za-z0-9]+)/i);
    if (match) cleaned = match[1];
  } else if (cleaned.includes('code=')) {
    const match = cleaned.match(/code=([A-Za-z0-9]+)/i);
    if (match) cleaned = match[1];
  }
  // Strip anything that isn't A-Z or 0-9, then uppercase, and take at most 6 chars
  cleaned = cleaned.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 6);
}

export function ColabProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, setLoginModalOpen } = useAuth();
  const player = usePlayer();
  const { showToast } = useToast();

  const [room, setRoom] = useState<ColabRoom | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<ColabReaction[]>([]);

  // Stores a room code from a shared link so we can auto-join once auth finishes loading
  const pendingJoinCodeRef = useRef<string | null>(null);

  // Flag to avoid feedback loops when synchronizing remote updates
  const isApplyingRemoteSyncRef = useRef(false);
  const seenReactionIdsRef = useRef<Set<string>>(new Set());
  const isInitialReactionsLoadRef = useRef(true);
  const prevMemberCountRef = useRef<number>(0);
  const isInitialMembersLoadRef = useRef(true);
  const prevHostIdRef = useRef<string | null>(null);
  const playerRef = useRef(player);
  playerRef.current = player;

  const isHost = Boolean(user && room && room.hostId === user.uid);
  const isMember = Boolean(user && room && room.members[user.uid]);
  const isInRoom = Boolean(room && isMember);
  const isColabLocked = Boolean(isInRoom && !isHost && room?.controlMode === 'host-only');

  // ─── Restore room from sessionStorage on mount ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedRoomId = sessionStorage.getItem(ROOM_STORAGE_KEY);
    if (savedRoomId && user) {
      joinRoom(savedRoomId).catch(() => {
        sessionStorage.removeItem(ROOM_STORAGE_KEY);
      });
    }
  }, [user?.uid]);

  // ─── Best-effort cleanup on tab close / browser exit ───
  useEffect(() => {
    if (!roomId || !user) return;

    const handleUnload = () => {
      const roomRef = doc(db, 'colab_rooms', roomId);
      updateDoc(roomRef, {
        [`members.${user.uid}`]: deleteField(),
        updatedAt: Date.now(),
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [roomId, user?.uid]);

  // ─── Auto-join pending room once auth is resolved ───
  // When a user clicks a shared link, auth may still be loading.
  // We store the room code in pendingJoinCodeRef and process it here
  // once authLoading becomes false and user is available.
  useEffect(() => {
    if (authLoading) return; // Still loading — wait
    const pendingCode = pendingJoinCodeRef.current;
    if (!pendingCode) return; // Nothing pending

    pendingJoinCodeRef.current = null; // Clear so we don't retry

    if (user) {
      joinRoom(pendingCode).catch(() => {});
    }
    // If user is null after auth loaded, the UI will naturally show the sign-in screen
  }, [authLoading, user?.uid]);

  // ─── Real-time Firestore Listener for Active Room ───
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      seenReactionIdsRef.current.clear();
      isInitialReactionsLoadRef.current = true;
      return;
    }

    seenReactionIdsRef.current.clear();
    isInitialReactionsLoadRef.current = true;
    prevMemberCountRef.current = 0;
    isInitialMembersLoadRef.current = true;
    prevHostIdRef.current = null;

    const roomRef = doc(db, 'colab_rooms', roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        showToast('This Colab room has ended.', 'info');
        setRoom(null);
        setRoomId(null);
        sessionStorage.removeItem(ROOM_STORAGE_KEY);
        return;
      }

      const data = snapshot.data() as ColabRoom;

      if (data.status === 'ended') {
        showToast('The host ended this Colab session.', 'info');
        setRoom(null);
        setRoomId(null);
        sessionStorage.removeItem(ROOM_STORAGE_KEY);
        return;
      }

      // Notify member if they were just promoted to host
      if (user && data.hostId === user.uid && prevHostIdRef.current && prevHostIdRef.current !== user.uid) {
        showToast('You are now the Host of this session!', 'success');
      }
      prevHostIdRef.current = data.hostId;

      setRoom(data);

      // Play pleasant "tunn" sound when a new member joins
      const currentMemberCount = Object.keys(data.members || {}).length;
      if (isInitialMembersLoadRef.current) {
        prevMemberCountRef.current = currentMemberCount;
        isInitialMembersLoadRef.current = false;
      } else if (currentMemberCount > prevMemberCountRef.current) {
        playMemberJoinSound();
        prevMemberCountRef.current = currentMemberCount;
      } else {
        prevMemberCountRef.current = currentMemberCount;
      }

      // Handle new incoming floating reactions (clock-skew safe via ID tracking)
      if (data.reactions && Array.isArray(data.reactions)) {
        if (isInitialReactionsLoadRef.current) {
          // On first snapshot, mark existing room reactions as seen so old history doesn't burst on screen
          data.reactions.forEach(r => seenReactionIdsRef.current.add(r.id));
          isInitialReactionsLoadRef.current = false;
        } else {
          const newReactions = data.reactions.filter(r => !seenReactionIdsRef.current.has(r.id));
          if (newReactions.length > 0) {
            newReactions.forEach(r => seenReactionIdsRef.current.add(r.id));
            setFloatingReactions(prev => [...prev, ...newReactions]);
            playReactionPopSound();

            // Clear reactions after animation
            setTimeout(() => {
              const idsToRemove = new Set(newReactions.map(r => r.id));
              setFloatingReactions(prev => prev.filter(r => !idsToRemove.has(r.id)));
            }, 3500);
          }
        }
      }

      // Check if user is a member of this room
      if (user && !data.members[user.uid]) {
        return; // Not in members list yet
      }

      // ── Apply Playback Synchronization ──
      // Skip if THIS user triggered the action (prevents feedback loop)
      if (data.lastActionBy === user?.uid) {
        return;
      }

      // Always sync for listeners, even during applyRemoteSync
      // (the ref only blocks the HOST observer from re-broadcasting)
      applyRemoteSync(data);
    }, (err) => {
      console.error('[Colab] onSnapshot error:', err);
      setError('Connection interrupted. Reconnecting...');
    });

    return () => unsubscribe();
  }, [roomId, user?.uid]);

  // ─── Broadcast Seek Directly (Called when scrubbing timeline) ───
  const broadcastSeek = useCallback(async (seconds: number) => {
    if (!roomId || !user) return;
    const canControl = isHost || room?.controlMode === 'collab';
    if (!canControl) return;

    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      await updateDoc(roomRef, {
        position: seconds,
        positionUpdatedAt: Date.now(),
        updatedAt: Date.now(),
        lastActionBy: user.uid,
      });
    } catch (err) {
      console.error('[Colab] broadcastSeek error:', err);
    }
  }, [roomId, user?.uid, isHost, room?.controlMode]);

  // ─── Apply Remote Sync with Drift Correction ───
  const applyRemoteSync = useCallback((remoteRoom: ColabRoom) => {
    if (!remoteRoom.currentSong) return;

    isApplyingRemoteSyncRef.current = true;
    const p = playerRef.current;

    // 1. Synchronize Song selection — if different song, play the new one immediately
    if (p.currentSong?.id !== remoteRoom.currentSong.id) {
      p.playSong(remoteRoom.currentSong, 'colab');
      // If song was already playing on host, seek to current position after load
      if (remoteRoom.position > 1) {
        setTimeout(() => {
          playerRef.current.seekTo(remoteRoom.position);
        }, 500);
      }
      setTimeout(() => {
        isApplyingRemoteSyncRef.current = false;
      }, 1000);
      return;
    }

    // 2. Synchronize Play/Pause State with explicit deterministic methods
    lastBroadcastIsPlayingRef.current = remoteRoom.isPlaying;
    if (remoteRoom.isPlaying) {
      if (!p.isPlaying) {
        p.resume();
      }
    } else {
      if (p.isPlaying) {
        p.pause();
      }
    }

    // 3. Sub-Second Synchronization Formula (Drift Correction)
    const currentAudioTime = p.getCurrentTime();
    let expectedPosition = remoteRoom.position;

    if (remoteRoom.isPlaying) {
      const elapsedSinceUpdate = (Date.now() - (remoteRoom.positionUpdatedAt || Date.now())) / 1000;
      expectedPosition = Math.max(0, remoteRoom.position + elapsedSinceUpdate);
    }

    const drift = Math.abs(currentAudioTime - expectedPosition);
    const driftThreshold = remoteRoom.isPlaying ? 1.2 : 0.5;

    // If audio drift is greater than threshold, seek to match the room
    if (drift > driftThreshold) {
      p.seekTo(expectedPosition);
    }

    setTimeout(() => {
      isApplyingRemoteSyncRef.current = false;
    }, 400);
  }, []);

  // ─── 1. Instant Host Song Change Observer ───
  const lastBroadcastSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || !roomId || !user) return;
    const canControl = isHost || room.controlMode === 'collab';
    if (!canControl) return;
    if (isApplyingRemoteSyncRef.current) return;
    if (!player.currentSong) return;

    if (player.currentSong.id !== lastBroadcastSongIdRef.current) {
      lastBroadcastSongIdRef.current = player.currentSong.id;

      const roomRef = doc(db, 'colab_rooms', roomId);
      const updateData: Record<string, any> = {
        currentSong: player.currentSong,
        isPlaying: player.isPlaying,
        position: 0,
        positionUpdatedAt: Date.now(),
        updatedAt: Date.now(),
        lastActionBy: user.uid,
      };

      // If room has manual queue items, set upcomingSong to next in queue
      if (room.queue && room.queue.length > 0) {
        updateData.upcomingSong = room.queue[0];
      }

      updateDoc(roomRef, updateData).catch(err => console.error('[Colab] Failed to broadcast song change:', err));
    }
  }, [roomId, user?.uid, isHost, room?.controlMode, room?.queue, player.currentSong?.id, player.isPlaying]);


  // ─── 2. Instant Host Play/Pause Observer ───
  const lastBroadcastIsPlayingRef = useRef<boolean>(player.isPlaying);
  useEffect(() => {
    if (!room || !roomId || !user) return;
    const canControl = isHost || room.controlMode === 'collab';
    if (!canControl) return;
    if (isApplyingRemoteSyncRef.current) return;
    if (!player.currentSong) return;

    if (player.isPlaying !== lastBroadcastIsPlayingRef.current) {
      lastBroadcastIsPlayingRef.current = player.isPlaying;
      const currentPos = playerRef.current.getCurrentTime();
      const roomRef = doc(db, 'colab_rooms', roomId);
      updateDoc(roomRef, {
        isPlaying: player.isPlaying,
        position: currentPos,
        positionUpdatedAt: Date.now(),
        updatedAt: Date.now(),
        lastActionBy: user.uid,
      }).catch(err => console.error('[Colab] Failed to broadcast play/pause state:', err));
    }
  }, [roomId, user?.uid, isHost, room?.controlMode, player.isPlaying]);

  // ─── 3. Periodic Position Heartbeat (Every 3.5s while playing) ───
  // AUTHORITATIVE TIMEKEEPER: ONLY THE HOST BROADCASTS AUDIO POSITION HEARTBEATS
  useEffect(() => {
    if (!room || !roomId || !user) return;
    if (!isHost || !player.isPlaying || !player.currentSong) return;

    const interval = setInterval(() => {
      if (isApplyingRemoteSyncRef.current) return;
      const currentPos = playerRef.current.getCurrentTime();
      const roomRef = doc(db, 'colab_rooms', roomId);
      updateDoc(roomRef, {
        position: currentPos,
        positionUpdatedAt: Date.now(),
        updatedAt: Date.now(),
        lastActionBy: user.uid,
      }).catch(err => console.error('[Colab] Position heartbeat error:', err));
    }, 3500);

    return () => clearInterval(interval);
  }, [roomId, user?.uid, isHost, player.isPlaying, player.currentSong?.id]);

  // ─── Actions ───

  /**
   * Create a new Colab room. Requires user to be logged in.
   */
  const createRoom = async (roomName?: string, controlMode: ColabControlMode = 'collab'): Promise<string | null> => {
    if (!user) {
      setLoginModalOpen(true);
      showToast('Please sign in to start a Colab session', 'info');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newRoomCode = generateRoomCode();
      const initialMember: ColabMember = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Host',
        avatar: user.photoURL || null,
        isHost: true,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        tasteProfile: getMyTasteProfile(user.displayName || user.email?.split('@')[0] || 'Host'),
      };

      const newRoomData: ColabRoom = {
        id: newRoomCode,
        name: roomName?.trim() || `${initialMember.name}'s Colab`,
        hostId: user.uid,
        hostName: initialMember.name,
        hostAvatar: initialMember.avatar,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active',
        controlMode,
        currentSong: player.currentSong || null,
        isPlaying: player.isPlaying,
        position: player.seek || 0,
        positionUpdatedAt: Date.now(),
        lastActionBy: user.uid,
        queue: [],
        members: {
          [user.uid]: initialMember,
        },
        reactions: [],
      };

      const roomRef = doc(db, 'colab_rooms', newRoomCode);
      await setDoc(roomRef, newRoomData);

      setRoomId(newRoomCode);
      setRoom(newRoomData);
      sessionStorage.setItem(ROOM_STORAGE_KEY, newRoomCode);
      showToast(`Colab Room created! Code: ${newRoomCode}`, 'success');

      return newRoomCode;
    } catch (err: any) {
      console.error('[Colab] Create Room Error:', err);
      setError('Failed to create Colab room. Try again.');
      showToast('Could not create room', 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Join an existing Colab room via code or link.
   */
  const joinRoom = async (codeOrLink: string): Promise<boolean> => {
    // If auth is still loading, queue the code for when it resolves
    if (authLoading) {
      pendingJoinCodeRef.current = codeOrLink;
      return false;
    }

    if (!user) {
      setLoginModalOpen(true);
      showToast('Please sign in to join a Colab room', 'info');
      return false;
    }

    const cleanCode = parseRoomCode(codeOrLink);
    if (!cleanCode) {
      showToast('Please enter a valid room code', 'error');
      return false;
    }

    // If already in this room, skip
    if (roomId === cleanCode) {
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      const roomRef = doc(db, 'colab_rooms', cleanCode);
      const snapshot = await getDoc(roomRef);

      if (!snapshot.exists()) {
        showToast('Room not found. Check the code and try again.', 'error');
        setIsLoading(false);
        return false;
      }

      const roomData = snapshot.data() as ColabRoom;
      if (roomData.status === 'ended') {
        showToast('This Colab session has already ended.', 'error');
        setIsLoading(false);
        return false;
      }

      // Add user to room's members map
      const memberInfo: ColabMember = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Friend',
        avatar: user.photoURL || null,
        isHost: roomData.hostId === user.uid,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        tasteProfile: getMyTasteProfile(user.displayName || user.email?.split('@')[0] || 'Friend'),
      };

      await updateDoc(roomRef, {
        [`members.${user.uid}`]: memberInfo,
        updatedAt: Date.now(),
      });

      setRoomId(cleanCode);
      setRoom({
        ...roomData,
        members: {
          ...roomData.members,
          [user.uid]: memberInfo,
        },
      });
      sessionStorage.setItem(ROOM_STORAGE_KEY, cleanCode);

      // Immediately sync player with room
      if (roomData.currentSong) {
        applyRemoteSync(roomData);
      }

      showToast(`Joined ${roomData.name}!`, 'success');
      return true;
    } catch (err: any) {
      console.error('[Colab] Join Room Error:', err?.code, err?.message, err);
      const msg = err?.code === 'permission-denied' 
        ? 'Permission denied. Make sure you are signed in.' 
        : `Failed to join Colab room`;
      showToast(msg, 'error');
      setError('Could not join room');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Leave the current room.
   */
  const leaveRoom = async () => {
    if (!roomId || !user) return;
    const currentSongBeforeLeave = player.currentSong;

    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      const snapshot = await getDoc(roomRef);

      if (snapshot.exists()) {
        const roomData = snapshot.data() as ColabRoom;
        const currentMembers = { ...roomData.members };
        delete currentMembers[user.uid];

        const remainingMemberIds = Object.keys(currentMembers);

        if (remainingMemberIds.length === 0) {
          // If no one is left, mark room as ended
          await updateDoc(roomRef, {
            status: 'ended',
            updatedAt: Date.now(),
          });
        } else if (roomData.hostId === user.uid) {
          // If host left, promote the earliest joined remaining member to host
          const otherMembers = Object.values(currentMembers).sort(
            (a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)
          );
          const nextHost = otherMembers[0];
          const nextHostId = nextHost.id;

          await updateDoc(roomRef, {
            [`members.${user.uid}`]: deleteField(),
            hostId: nextHostId,
            hostName: nextHost.name,
            hostAvatar: nextHost.avatar || null,
            [`members.${nextHostId}.isHost`]: true,
            updatedAt: Date.now(),
          });
        } else {
          // Standard member left
          await updateDoc(roomRef, {
            [`members.${user.uid}`]: deleteField(),
            updatedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error('[Colab] Error leaving room:', err);
    } finally {
      setRoom(null);
      setRoomId(null);
      sessionStorage.removeItem(ROOM_STORAGE_KEY);
      player.setNextSongOverride(null);

      // Restore solo queue radio so the user can continue listening alone
      if (currentSongBeforeLeave) {
        import('@/core/player/RadioQueueGenerator').then(mod => {
          mod.RadioQueueGenerator.generateQueue(currentSongBeforeLeave).then(radioQueue => {
            if (radioQueue && radioQueue.length > 0) {
              player.setQueueConfig([currentSongBeforeLeave, ...radioQueue], 0);
            }
          }).catch(() => {});
        }).catch(() => {});
      }

      showToast('Left Colab session', 'info');
    }
  };

  /**
   * Host ends the room for everyone.
   */
  const endRoom = async () => {
    if (!roomId || !user || !isHost) return;
    const currentSongBeforeLeave = player.currentSong;

    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      await updateDoc(roomRef, {
        status: 'ended',
        updatedAt: Date.now(),
      });
      showToast('Colab session ended', 'info');
    } catch (err) {
      console.error('[Colab] End room error:', err);
    } finally {
      setRoom(null);
      setRoomId(null);
      sessionStorage.removeItem(ROOM_STORAGE_KEY);
      player.setNextSongOverride(null);

      if (currentSongBeforeLeave) {
        import('@/core/player/RadioQueueGenerator').then(mod => {
          mod.RadioQueueGenerator.generateQueue(currentSongBeforeLeave).then(radioQueue => {
            if (radioQueue && radioQueue.length > 0) {
              player.setQueueConfig([currentSongBeforeLeave, ...radioQueue], 0);
            }
          }).catch(() => {});
        }).catch(() => {});
      }
    }
  };

  /**
   * Send live floating emoji reaction
   */
  const sendReaction = async (emoji: string) => {
    if (!roomId || !user) return;

    const reaction: ColabReaction = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      emoji,
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || 'Friend',
      timestamp: Date.now(),
    };

    // Mark as seen immediately so the Firestore snapshot echo does not duplicate it
    seenReactionIdsRef.current.add(reaction.id);

    // Show locally immediately and play soft pop sound
    playReactionPopSound();
    setFloatingReactions(prev => [...prev, reaction]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
    }, 3500);

    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      await updateDoc(roomRef, {
        reactions: arrayUnion(reaction),
      });
    } catch (err) {
      console.error('[Colab] Error sending reaction:', err);
    }
  };

  /**
   * Add a song to the collaborative queue
   */
  const addToColabQueue = async (song: Song) => {
    if (!roomId || !user) return;

    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      const currentQueue = room?.queue || [];
      const updatedQueue = [...currentQueue, song];

      await updateDoc(roomRef, {
        queue: updatedQueue,
        updatedAt: Date.now(),
      });

      showToast(`Added "${song.name}" to Colab Queue`, 'success');
    } catch (err) {
      console.error('[Colab] Error adding to queue:', err);
      showToast('Failed to add song to queue', 'error');
    }
  };

  /**
   * Remove a song from the collaborative queue
   */
  const removeFromColabQueue = async (index: number) => {
    if (!roomId || !user) return;

    const canControl = isHost || room?.controlMode === 'collab';
    if (!canControl) {
      showToast('Only host can remove from queue', 'info');
      return;
    }

    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      const currentQueue = [...(room?.queue || [])];
      currentQueue.splice(index, 1);

      await updateDoc(roomRef, {
        queue: currentQueue,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('[Colab] Error removing from queue:', err);
    }
  };

  /**
   * Immediately play a specific song in the room
   */
  const playColabSong = async (song: Song) => {
    if (!roomId || !user) return;

    const canControl = isHost || room?.controlMode === 'collab';
    if (!canControl) {
      showToast('Host controls playback in this room', 'info');
      return;
    }

    try {
      player.playSong(song, 'colab');
      const roomRef = doc(db, 'colab_rooms', roomId);
      await updateDoc(roomRef, {
        currentSong: song,
        isPlaying: true,
        position: 0,
        positionUpdatedAt: Date.now(),
        updatedAt: Date.now(),
        lastActionBy: user.uid,
      });
    } catch (err) {
      console.error('[Colab] Error playing song:', err);
    }
  };

  /**
   * Play the next song in the Colab Queue (or fallback to auto-queue)
   */
  const playNextInColabQueue = useCallback(async () => {
    if (!roomId || !user || !room) return;
    const canControl = isHost || room?.controlMode === 'collab';
    if (!canControl) {
      showToast('Host controls playback in this room', 'info');
      return;
    }

    const currentHistory = [...(room.history || []).slice(-15)];
    if (room.currentSong) {
      currentHistory.push(room.currentSong);
    }

    if (room.queue && room.queue.length > 0) {
      const nextSong = room.queue[0];
      const remainingQueue = room.queue.slice(1);
      player.playSong(nextSong, 'colab');

      const roomRef = doc(db, 'colab_rooms', roomId);
      await updateDoc(roomRef, {
        currentSong: nextSong,
        queue: remainingQueue,
        history: currentHistory,
        isPlaying: true,
        position: 0,
        positionUpdatedAt: Date.now(),
        updatedAt: Date.now(),
        lastActionBy: user.uid,
      });
      return;
    } 
    
    if (room.upcomingSongs && room.upcomingSongs.length > 0) {
      const dismissed = new Set(room.dismissedUpcomingIds || []);
      const nextSong = room.upcomingSongs.find((s) => s && s.id !== room.currentSong?.id && !dismissed.has(s.id));
      if (nextSong) {
        player.playSong(nextSong, 'colab');
        const remainingUpcoming = room.upcomingSongs.filter((s) => s && s.id !== nextSong.id);
        const roomRef = doc(db, 'colab_rooms', roomId);
        await updateDoc(roomRef, {
          currentSong: nextSong,
          history: currentHistory,
          upcomingSongs: remainingUpcoming,
          upcomingSong: remainingUpcoming[0] || null,
          isPlaying: true,
          position: 0,
          positionUpdatedAt: Date.now(),
          updatedAt: Date.now(),
          lastActionBy: user.uid,
        });
        return;
      }
    }

    // Queue is fully exhausted — safely pause room playback without recursive loop
    player.pause();
    const roomRef = doc(db, 'colab_rooms', roomId);
    await updateDoc(roomRef, {
      isPlaying: false,
      position: 0,
      positionUpdatedAt: Date.now(),
      updatedAt: Date.now(),
      lastActionBy: user.uid,
    });
    showToast('Colab queue ended. Add more songs to continue.', 'info');
  }, [roomId, user?.uid, isHost, room, player, showToast]);

  /**
   * Play previous song in Colab history or restart current song
   */
  const playPrevInColabSong = useCallback(async () => {
    if (!roomId || !user || !room) return;
    const canControl = isHost || room?.controlMode === 'collab';
    if (!canControl) {
      showToast('Host controls playback in this room', 'info');
      return;
    }

    const currentSeek = playerRef.current.getCurrentTime();
    if (currentSeek > 3) {
      player.seekTo(0);
      broadcastSeek(0);
      return;
    }

    const roomHistory = room.history || [];
    if (roomHistory.length === 0) {
      player.seekTo(0);
      broadcastSeek(0);
      return;
    }

    const prevSong = roomHistory[roomHistory.length - 1];
    const remainingHistory = roomHistory.slice(0, -1);
    const updatedQueue = room.currentSong ? [room.currentSong, ...(room.queue || [])] : (room.queue || []);

    player.playSong(prevSong, 'colab');
    const roomRef = doc(db, 'colab_rooms', roomId);
    await updateDoc(roomRef, {
      currentSong: prevSong,
      queue: updatedQueue,
      history: remainingHistory,
      isPlaying: true,
      position: 0,
      positionUpdatedAt: Date.now(),
      updatedAt: Date.now(),
      lastActionBy: user.uid,
    });
  }, [roomId, user?.uid, isHost, room, player, broadcastSeek, showToast]);

  // Register Colab nextSongOverride so that track ends / skips / lockscreen actions
  // advance the Colab room queue instead of falling back to solo playback.
  // ONLY the Host's onEnd automatically pops the queue to prevent multi-device race conditions.
  useEffect(() => {
    if (!roomId || !room) {
      player.setNextSongOverride(null);
      return;
    }

    if (isHost) {
      player.setNextSongOverride(() => {
        playNextInColabQueue();
      });
    } else {
      player.setNextSongOverride(() => {
        // Listener reached track end: pause locally and await host song broadcast
        player.pause();
      });
    }

    return () => {
      player.setNextSongOverride(null);
    };
  }, [roomId, room?.id, isHost, playNextInColabQueue, player.setNextSongOverride, player.pause]);

  /**
   * Dismiss an upcoming song so it won't play next
   */
  const dismissUpcomingSong = async (songId: string) => {
    if (!roomId || !user) return;
    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      const existing = room?.dismissedUpcomingIds || [];
      if (!existing.includes(songId)) {
        await updateDoc(roomRef, {
          dismissedUpcomingIds: [...existing, songId],
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('[Colab] Error dismissing upcoming song:', err);
    }
  };

  /**
   * Change room control mode (Host Only vs Collaborative DJ)
   */
  const setControlMode = async (mode: ColabControlMode) => {
    if (!roomId || !user || !isHost) return;

    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      await updateDoc(roomRef, {
        controlMode: mode,
        updatedAt: Date.now(),
      });
      showToast(`Mode set to: ${mode === 'collab' ? 'Everyone Can DJ' : 'Host Controls Only'}`, 'info');
    } catch (err) {
      console.error('[Colab] Error setting mode:', err);
    }
  };

  /**
   * Auto-sync taste profile to room if not yet present
   */
  useEffect(() => {
    if (!roomId || !user || !room) return;
    const currentMember = room.members?.[user.uid];
    if (currentMember && !currentMember.tasteProfile) {
      const profile = getMyTasteProfile(user.displayName || user.email?.split('@')[0] || 'Friend');
      syncTasteProfileToRoom(roomId, user.uid, profile);
    }
  }, [roomId, user?.uid, room?.members]);

  /**
   * Force sync with host (authoritative direct Firestore read)
   */
  const syncWithHost = async () => {
    if (!roomId) return;
    try {
      const roomRef = doc(db, 'colab_rooms', roomId);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const freshRoom = snap.data() as ColabRoom;
        setRoom(freshRoom);
        if (freshRoom.currentSong) {
          applyRemoteSync(freshRoom);
          showToast('Audio synced with session!', 'success');
          return;
        }
      }
      if (room && room.currentSong) {
        applyRemoteSync(room);
        showToast('Synced with Colab session!', 'success');
      } else {
        showToast('Session is currently idle', 'info');
      }
    } catch (err) {
      console.error('[Colab] Force sync failed:', err);
      if (room && room.currentSong) {
        applyRemoteSync(room);
        showToast('Synced with cached session', 'info');
      }
    }
  };

  /**
   * Store a room code to auto-join once auth finishes loading
   */
  const setPendingJoinCode = useCallback((code: string) => {
    pendingJoinCodeRef.current = code;
  }, []);

  return (
    <ColabContext.Provider value={{
      room,
      roomId,
      isHost,
      isMember,
      isInRoom,
      isLoading,
      authLoading,
      isColabLocked,
      error,
      floatingReactions,
      createRoom,
      joinRoom,
      leaveRoom,
      endRoom,
      sendReaction,
      addToColabQueue,
      removeFromColabQueue,
      dismissUpcomingSong,
      playColabSong,
      playNextInColabQueue,
      playPrevInColabSong,
      setControlMode,
      syncWithHost,
      broadcastSeek,
      setPendingJoinCode,
    }}>
      {children}
    </ColabContext.Provider>
  );
}

export function useColab(): ColabContextType {
  const context = useContext(ColabContext);
  if (!context) {
    throw new Error('useColab must be used within a ColabProvider');
  }
  return context;
}
