import React, { Suspense } from 'react';
import PlaylistContainer from '@/features/playlist/PlaylistContainer';

export default function PlaylistDetailPage() {
    return (
      <Suspense fallback={null}>
        <PlaylistContainer />
      </Suspense>
    );
}
