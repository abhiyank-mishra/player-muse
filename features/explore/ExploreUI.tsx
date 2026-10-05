import React from 'react';
import { Play, ChevronLeft } from 'lucide-react';
import ExploreCard from './components/ExploreCard';
import { ExploreState, ExploreActions } from './explore.types';

interface ExploreUIProps {
  state: ExploreState;
  actions: ExploreActions;
}

export default function ExploreUI({ state, actions }: ExploreUIProps) {
  const { songs: uniqueSongs, loading, error, isReady, currentSong, user } = state;
  const { handleStartExplorer, handleBack, loadMore, togglePlay, setQueueConfig, containerRef } = actions;

  if (loading && uniqueSongs.length === 0) {
    return (
      <div className="h-[100dvh] w-full bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
        <div className="relative z-10 w-full max-w-md p-6 flex flex-col items-center justify-center h-full pb-20 animate-pulse">
            <div className="w-[80vw] h-[80vw] max-w-[320px] max-h-[320px] bg-white/5 rounded-2xl mb-8 aspect-square" />
            <div className="w-48 h-8 bg-white/5 rounded-lg mb-3" />
            <div className="w-32 h-6 bg-white/5 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error && uniqueSongs.length === 0) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="text-red-400 text-xl mb-4">⚠️ {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* UNDER DEVELOPMENT OVERLAY */}
      <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <span className="text-5xl">🚧</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">Explore Mode<br/><span className="text-purple-400">Under Development</span></h1>
        <p className="text-gray-400 text-lg mb-8 max-w-md leading-relaxed">
          We are actively building a completely new and immersive discovery experience. Stay tuned!
        </p>
        <button 
          onClick={handleBack}
          className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-all shadow-lg shadow-purple-500/25 active:scale-95"
        >
          Go Back to Home
        </button>
      </div>

      <div className="fixed top-6 left-6 z-[60] md:hidden">
          <button 
            onClick={handleBack}
            className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/5 text-white active:scale-95 shadow-xl hover:bg-white/20 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
      </div>

      <div 
        ref={containerRef}
        className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black no-scrollbar snap-always touch-pan-y"
      >
        
      {!isReady && !loading && !error && uniqueSongs.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center">
            <button 
                onClick={handleStartExplorer}
                className="group flex flex-col items-center gap-4 transition-transform hover:scale-105 active:scale-95"
            >
                <div className="p-8 bg-purple-600 rounded-full shadow-[0_0_50px_rgba(147,51,234,0.5)] group-hover:shadow-[0_0_80px_rgba(147,51,234,0.7)] transition-shadow">
                    <Play className="w-12 h-12 text-white fill-white ml-2" />
                </div>
                <span className="text-white text-2xl font-bold tracking-wide">Tap to Start Exploring</span>
                <span className="text-gray-400 text-sm">Turn up the volume! 🎧</span>
            </button>
        </div>
      )}

      {uniqueSongs.map((song, index) => (
         <ExploreCard 
            key={`explore-${song.id}-${index}`}
            song={song} 
            user={user} 
            isActive={currentSong?.id === song.id}
            onPlay={() => {
                if (currentSong?.id === song.id) {
                    togglePlay();
                } else {
                    const idx = uniqueSongs.findIndex(s => s.id === song.id);
                    setQueueConfig(uniqueSongs, idx);
                }
            }}
         />
      ))}
      
      {loading && uniqueSongs.length > 0 && (
          <div className="snap-start h-[20vh] w-full flex items-center justify-center bg-transparent">
               <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      )}

      </div>
    </>
  );
}
