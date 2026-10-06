import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Sparkles, Menu, RotateCw } from 'lucide-react';
import FeaturedPlaylists from '@/components/FeaturedPlaylists';
import SongCard from '@/components/SongCard';
import SongListItem from '@/components/SongListItem';
import Footer from '@/components/Footer';
import UserPlaylists from '@/components/UserPlaylists';
import { HomeState, HomeActions } from './home.types';
import { Song } from '@/lib/types';
import { getPreviousSongs } from '@/lib/preferences';

interface HomeUIProps {
  state: HomeState;
  actions: HomeActions;
}

export default function HomeUI({ state, actions }: HomeUIProps) {
  const { 
    user, userName, query, results, communityTrending, 
    globalExplorer, loading, dailyPlays, streak, madeForYou, madeForYouPersonalized 
  } = state;

  const { 
    setQuery, loadCommunityTrending, handlePlayAll, 
    toggleSidebar, setQueueConfig, playSong, searchMusic 
  } = actions;

  const [previousSongs, setPreviousSongs] = useState<Song[]>([]);

  useEffect(() => {
    setPreviousSongs(getPreviousSongs());

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setPreviousSongs(e.detail);
      } else {
        setPreviousSongs(getPreviousSongs());
      }
    };

    window.addEventListener('muse:previous_songs_updated', handleUpdate);
    return () => window.removeEventListener('muse:previous_songs_updated', handleUpdate);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      searchMusic(query);
    }
  };

  const firstName = userName?.split(' ')[0] || user?.displayName?.split(' ')[0] || 'User';

  return (
    <div 
      className="p-4 md:p-8 max-w-7xl mx-auto pb-32"
    >
      {/* Hero / Search Section */}
      <div className="flex flex-col gap-6 md:gap-8 mb-8 md:mb-16 mt-2 md:mt-8">
        <div className="flex items-start justify-between gap-6">
          <div>
             <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 tracking-tight">
               Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">{firstName}</span>
             </h1>
             {user && (
                 <p className="text-gray-400 text-sm md:text-base font-medium flex items-center gap-2 mt-1">
                   <span className="bg-white/5 px-3 py-1 rounded-lg text-xs border border-white/10 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-purple-400">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                      </svg>
                      {dailyPlays} plays today
                   </span>
                   {streak > 0 && (
                     <span className="bg-orange-500/10 px-3 py-1 rounded-lg text-xs border border-orange-500/20 text-orange-400 flex items-center gap-1.5 font-semibold">
                       <Sparkles className="w-3 h-3 fill-orange-400" /> {streak} day streak
                     </span>
                   )}
                 </p>
             )}
          </div>
          
          {/* Search Bar - Desktop Only, Right Side */}
          <div className="flex items-center gap-2">
            <Link 
              href="/search"
              className="hidden md:flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-3 min-w-[350px] transition-all cursor-pointer group"
            >
              <Search className="w-6 h-6 text-gray-400 group-hover:text-purple-400 transition-colors" />
              <span className="text-gray-400 group-hover:text-gray-300 transition-colors text-lg">Search songs, artists...</span>
            </Link>
            
            <button 
              onClick={toggleSidebar} 
              className="md:hidden p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors active:scale-95 border border-white/10"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="flex flex-col gap-12">
        
        {/* User Playlists Section (Moved to Top) */}
        {query.length === 0 && <UserPlaylists />}

        {/* Muse For You Section */}
        {madeForYou.length > 0 && query.length === 0 && (
             <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                        {madeForYouPersonalized ? 'Muse for you' : 'Discover Music'}
                        </h2>
                        <p className="text-gray-500 text-[10px] md:text-sm mt-0.5">
                            {madeForYouPersonalized ? 'Persona' : 'Top songs to get you started'}
                        </p>
                    </div>
                </div>
                {/* Horizontal Scroll row — use -webkit-overflow-scrolling for mobile */}
                <div className="flex w-full overflow-x-auto pb-6 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                    {madeForYou.slice(0, 25).map((song) => (
                        <div key={`mfy-${song.id}`} className="w-[140px] md:w-[160px] pr-4 md:pr-6 flex-shrink-0">
                            <SongCard 
                                song={song} 
                                onPlay={() => playSong(song, 'standalone')}
                            />
                        </div>
                    ))}
                </div>
             </div>
        )}

        {/* Previous Muse Section */}
        {previousSongs.length > 0 && query.length === 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                  Previous Muse
                </h2>
                <p className="text-gray-500 text-[10px] md:text-sm mt-0.5">
                  Recent songs
                </p>
              </div>
            </div>
            {/* Horizontal Scroll row */}
            <div className="flex w-full overflow-x-auto pb-6 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
              {previousSongs.slice(0, 6).map((song) => (
                <div key={`prev-${song.id}`} className="w-[140px] md:w-[160px] pr-4 md:pr-6 flex-shrink-0">
                  <SongCard 
                    song={song} 
                    onPlay={() => playSong(song, 'standalone')}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Community Trending Section */}
        {communityTrending.length > 0 && query.length === 0 && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col">
              <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                Trending Hits
                <span className="px-1.5 py-0.5 bg-purple-600/20 text-purple-400 text-[10px] md:text-xs rounded-md uppercase tracking-wider">Top Chart</span>
              </h2>
              <p className="text-gray-500 text-[10px] md:text-sm mt-0.5">Ranked by community vibes</p>
            </div>
            
            {/* Top Boxes in Horizontal Scroll */}
            <div className="flex w-full overflow-x-auto pb-6 snap-x snap-mandatory hide-scrollbar scroll-smooth" style={{ scrollSnapType: 'x mandatory', touchAction: 'pan-x pan-y' }}>
              {communityTrending.slice(0, 25).map((song) => (
                <div key={`top-${song.id}`} className="w-[140px] md:w-[160px] pr-4 md:pr-6 flex-shrink-0 snap-start">
                    <SongCard 
                        song={song} 
                        onPlay={() => playSong(song, 'standalone')}
                        onLikeToggle={() => loadCommunityTrending(false)}
                    />
                </div>
              ))}
            </div>
            {/* Removed vertical stacking List View here */}
          </div>
        )}

        {/* Featured Playlists Section */}
        {query.length === 0 && <FeaturedPlaylists />}



        {(results.length > 0 || globalExplorer.length > 0) && (
           <div className="flex items-center justify-between mb-2">
             <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight">
                {query.length > 0 ? "Search Results" : "Discover More"}
             </h2>
             <button 
                onClick={handlePlayAll} 
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/5 hover:bg-white/10 text-purple-400 text-[10px] md:text-sm font-bold transition-colors whitespace-nowrap"
             >
               Stream All
             </button>
            </div>
         )}
         
         {/* Search Results / Global Explorer */}
         <div className="flex flex-col gap-6">
           {loading ? (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
               {[...Array(8)].map((_, i) => (
                 <div key={i} className="animate-pulse">
                   <div className="aspect-square bg-gray-800 rounded-2xl mb-3"></div>
                   <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                   <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                 </div>
               ))}
             </div>
           ) : results.length > 0 ? (
             <>
               {/* Curated Playlists */}
               {results.filter((item: any) => item.type === 'curated_playlist').map((playlist: any) => (
                 <div key={playlist.id} className="mb-4">
                   {/* Recommendation Label */}
                   <div className="flex items-center gap-2 mb-3">
                     <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
                     <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                         <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                       </svg>
                       Muse recommend for "{query}"
                     </p>
                     <div className="h-px flex-1 bg-gradient-to-r from-purple-500/30 via-transparent to-transparent"></div>
                   </div>

                   {/* Playlist Card */}
                   <Link 
                     href={`/playlist/curated/${playlist.id}`}
                     className="block bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-4 hover:scale-[1.02] transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20"
                   >
                     <div className="flex items-center gap-4">
                       <img 
                         src={playlist.coverImage || '/placeholder.png'} 
                         alt={playlist.name}
                         className="w-20 h-20 rounded-xl object-cover shadow-lg"
                       />
                       <div className="flex-1 min-w-0">
                         <h3 className="text-lg font-bold text-white mb-1 truncate">{playlist.name}</h3>
                         {playlist.description && (
                           <p className="text-sm text-gray-400 mb-2 line-clamp-2">{playlist.description}</p>
                         )}
                         <div className="flex items-center gap-3 text-xs text-gray-500">
                           <span className="flex items-center gap-1">
                             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                               <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                             </svg>
                             {playlist.songs?.length || 0} songs
                           </span>
                           <span className="text-purple-400 font-semibold">Curated Playlist →</span>
                         </div>
                       </div>
                     </div>
                   </Link>
                 </div>
               ))}

               {/* Regular Songs Grid */}
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                 {results.filter((item: any) => item.type !== 'curated_playlist').map((song, index) => (
                   <SongCard 
                     key={song.id} 
                     song={song} 
                     onPlay={() => playSong(song, 'standalone')}
                   />
                 ))}
               </div>
             </>
           ) : (
             <div className="flex flex-col gap-6 w-full">
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                   {globalExplorer.filter((item: any) => item.type !== 'curated_playlist').map((song, index) => (
                     <SongCard 
                       key={`global-${song.id}`} 
                       song={song} 
                       onPlay={() => playSong(song, 'standalone')}
                     />
                   ))}
                 </div>
                 
                 {/* Load More Button implementation */}
                 {query.length === 0 && state.allDiscoverSongs.length > globalExplorer.length && (
                    <button 
                         onClick={actions.loadMoreDiscover}
                         className="self-center px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/10 active:scale-95 text-sm uppercase tracking-widest mt-4"
                    >
                         Load More
                    </button>
                 )}
             </div>
           )}
           
           {results.length === 0 && !loading && query.length > 2 && (
             <div className="col-span-full text-center py-20">
               <p className="text-gray-500 text-lg">No songs found. Try a different search.</p>
             </div>
           )}
         </div>
        <Footer />
      </div>
    </div>
  );
}
