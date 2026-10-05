"use client";

import React, { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useColab } from '@/contexts/ColabContext';
import ActiveColabRoomView from '@/components/colab/ActiveColabRoomView';
import ColabLobbyView from '@/components/colab/ColabLobbyView';
import Spinner from '@/reusable/animations/loading/Spinner';

function ColabContent() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room') || '';
  const { isInRoom, joinRoom, roomId, isLoading, authLoading, setPendingJoinCode } = useColab();
  const hasAttemptedJoin = useRef(false);

  // Handle shared invite links: /colab?room=A7K2X9
  // If auth is still loading, queue the code for auto-join after auth resolves.
  // If auth is done and user is available, join directly.
  useEffect(() => {
    if (!roomParam) return;
    if (isInRoom) return; // Already in a room
    if (hasAttemptedJoin.current) return;

    if (authLoading) {
      // Auth hasn't resolved yet — store code so it joins automatically once auth finishes
      setPendingJoinCode(roomParam);
      return;
    }

    // Auth is resolved — attempt join now
    hasAttemptedJoin.current = true;
    joinRoom(roomParam).catch(() => {});
  }, [roomParam, isInRoom, authLoading]);

  // Show loading spinner while auth is still resolving OR join is in progress
  if (authLoading || (roomParam && isLoading && !isInRoom)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="w-8 h-8 text-purple-400" />
          <p className="text-xs text-zinc-500">{authLoading ? 'Connecting...' : 'Joining room...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 md:p-8 flex flex-col justify-start">
      {isInRoom ? (
        <ActiveColabRoomView />
      ) : (
        <ColabLobbyView initialCode={roomParam} />
      )}
    </div>
  );
}

export default function ColabPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8 text-purple-400" />
      </div>
    }>
      <ColabContent />
    </Suspense>
  );
}
