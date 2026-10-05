import React from 'react';
import { Heart } from 'lucide-react';
import UniversalPlaylistView from '@/components/UniversalPlaylistView';
import Spinner from '@/reusable/animations/loading/Spinner';
import { FavoritesState, FavoritesActions } from './favorites.types';

interface FavoritesUIProps {
  state: FavoritesState;
  actions: FavoritesActions;
}

export default function FavoritesUI({ state, actions }: FavoritesUIProps) {
  const { user, authLoading, songs, loading, hasMore, loadingMore } = state;
  const { loadFavorites, handlePlay, handlePlayAll, login } = actions;

  if (authLoading) return (
    <div className="flex items-center justify-center h-full">
      <Spinner className="w-8 h-8 text-purple-500" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-6 px-6 text-center">
      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
        <Heart className="w-10 h-10 text-gray-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Login to see your favorites</h1>
        <p className="text-gray-400 max-w-xs mx-auto">Save the songs you love and they will appear here.</p>
      </div>
      <button 
        onClick={login}
        className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20 active:scale-95"
      >
        Sign in with Google
      </button>
    </div>
  );

  return (
    <UniversalPlaylistView 
        title="Liked Songs"
        subtitle="Playlist"
        image={songs[0]?.image?.[2] || songs[0]?.image?.[0]} 
        songs={songs}
        loading={loading}
        onPlay={handlePlay}
        onPlayAll={handlePlayAll}
        onLoadMore={() => loadFavorites(true)}
        hasMore={hasMore}
        loadingMore={loadingMore}
        stats={
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                    {user?.displayName?.[0]}
                </div>
                <span className="font-bold text-white hover:underline cursor-pointer">{user?.displayName}</span>
                <span className="text-gray-400">• {songs.length} songs</span>
            </div>
        }
    />
  );
}
