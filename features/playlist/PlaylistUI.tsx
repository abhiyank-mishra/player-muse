import React from 'react';
import UniversalPlaylistView from '@/components/UniversalPlaylistView';
import { PlaylistState, PlaylistActions } from './playlist.types';

interface PlaylistUIProps {
  state: PlaylistState;
  actions: PlaylistActions;
}

export default function PlaylistUI({ state, actions }: PlaylistUIProps) {
    const { allSongs, visibleSongs, playlistInfo, loading, hasMore } = state;
    const { handlePlay, handlePlayAll, handleLoadMore } = actions;

    const coverImg = playlistInfo?.image || (allSongs[0]?.image ? (Array.isArray(allSongs[0].image) ? allSongs[0].image[2] || allSongs[0].image[0] : allSongs[0].image) : undefined);

    return (
        <UniversalPlaylistView 
            title={playlistInfo?.name || "Featured Chart"}
            subtitle={playlistInfo?.subtitle || "Playlist"}
            image={coverImg}
            description={playlistInfo?.description}
            songs={visibleSongs}
            loading={loading}
            onPlay={handlePlay}
            onPlayAll={handlePlayAll}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            playlistId={playlistInfo?.id}
        />
    );
}
