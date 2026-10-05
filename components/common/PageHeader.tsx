"use client";
import React from 'react';
import { ArrowLeft, Clock, Play, Shuffle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  image?: string;
  stats?: {
    count: number;
    duration?: number;
  };
  actions?: {
    onPlayAll: () => void;
    onShuffle: () => void;
  };
  backLink?: string; // Optional custom back link
}

export default function PageHeader({ 
  title, 
  subtitle, 
  image, 
  stats, 
  actions,
  backLink 
}: PageHeaderProps) {
  const router = useRouter();

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} hr ${mins} min`;
    return `${mins} min`;
  };

  return (
    <div className="p-6 md:p-8 bg-gradient-to-b from-purple-900/40 to-black">
      <button 
         onClick={() => backLink ? router.push(backLink) : router.back()}
         className="mb-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex items-center w-fit"
      >
          <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="flex flex-col md:flex-row items-end gap-6">
          <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl shadow-2xl overflow-hidden bg-zinc-800 flex-shrink-0">
              <img 
                 src={typeof image === 'string' && image.trim() !== '' ? image : '/placeholder.png'} 
                 alt={title}
                 className="w-full h-full object-cover"
              />
          </div>
          <div className="flex-1">
              {subtitle && (
                <h2 className="text-sm font-bold tracking-widest text-purple-400 uppercase mb-2">{subtitle}</h2>
              )}
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 line-clamp-2">{title}</h1>
              
              {stats && (
                <div className="flex items-center gap-4 text-gray-400 text-sm">
                    <span>{stats.count} songs</span>
                    {stats.duration !== undefined && (
                        <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatDuration(stats.duration)}
                            </span>
                        </>
                    )}
                </div>
              )}
          </div>
      </div>

      {/* Action Buttons */}
      {actions && (
        <div className="flex gap-4 mt-8">
            <button
                 onClick={actions.onPlayAll}
                 className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
                 <Play className="w-5 h-5 fill-white" />
                 Play All
            </button>
            <button
                 onClick={actions.onShuffle}
                 className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-bold backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
            >
                 <Shuffle className="w-5 h-5" />
                 Shuffle
            </button>
        </div>
      )}
    </div>
  );
}
