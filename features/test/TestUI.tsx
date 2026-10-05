import React from 'react';
import { TestSearchState, TestSearchActions } from './test.types';

export default function TestUI({ state, actions }: { state: TestSearchState, actions: TestSearchActions }) {
  const { query, results, loading, error } = state;
  const { setQuery } = actions;

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6 text-purple-400">Search Engine V2 Sandbox</h1>
      
      <input 
        type="text" 
        value={query} 
        onChange={e => setQuery(e.target.value)}
        placeholder="Search 'Arijit Singh'..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-8 outline-none focus:border-purple-500 transition-colors"
      />

      {loading && <p className="text-gray-400">Searching...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <div className="flex flex-col gap-8">
            {/* Artists */}
            {results.artists.length > 0 && (
                <div>
                   <h2 className="text-xl font-bold mb-3 border-b border-white/10 pb-2">Top Artist Matches</h2>
                   <div className="flex gap-4 overflow-x-auto pb-4">
                       {results.artists.map(a => (
                           <div key={a.id} className="min-w-[150px] bg-white/5 p-4 rounded-xl flex flex-col items-center gap-2">
                               <img src={a.image || '/placeholder.png'} className="w-20 h-20 rounded-full object-cover" />
                               <p className="font-bold text-center text-sm">{a.name}</p>
                               <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 rounded-full">Artist</span>
                           </div>
                       ))}
                   </div>
                </div>
            )}

            {/* Playlists */}
            {results.playlists.length > 0 && (
                <div>
                   <h2 className="text-xl font-bold mb-3 border-b border-white/10 pb-2">Playlists</h2>
                   <div className="flex gap-4 overflow-x-auto pb-4">
                       {results.playlists.map(p => (
                           <div key={p.id} className="min-w-[150px] bg-white/5 p-3 rounded-xl">
                               <img src={p.image || '/placeholder.png'} className="w-full aspect-square rounded-lg object-cover mb-2" />
                               <p className="font-bold text-sm truncate">{p.title}</p>
                           </div>
                       ))}
                   </div>
                </div>
            )}

            {/* Songs */}
            {results.songs.length > 0 && (
                <div>
                   <h2 className="text-xl font-bold mb-3 border-b border-white/10 pb-2">Top Songs</h2>
                   <div className="flex flex-col gap-2">
                       {results.songs.map(s => (
                           <div key={s.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                               <img src={s.image?.[0] || '/placeholder.png'} className="w-10 h-10 rounded object-cover" />
                               <div className="flex-1 min-w-0">
                                   <p className="font-bold text-sm truncate">{s.name}</p>
                                   <p className="text-xs text-gray-400 truncate">{s.artist}</p>
                               </div>
                           </div>
                       ))}
                   </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}
