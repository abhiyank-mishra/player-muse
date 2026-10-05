"use client";

import React, { useState } from 'react';
import { Song } from '@/lib/types';
import { Play, Pause, Share2, Check } from 'lucide-react';
import LikeButton from '@/reusable/ui/buttons/LikeButton';
import { usePlayer } from '@/contexts/PlayerContext';

interface ExploreCardProps {
    song: Song;
    user: any;
    isActive: boolean;
    onPlay: () => void;
}

export default function ExploreCard({ song, user, isActive, onPlay }: ExploreCardProps) {
    const { isPlaying, togglePlay } = usePlayer();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleShare = async () => {
        const sourceSuffix = song.source === 'soundcloud' ? '?source=soundcloud' : '';
        const url = `${window.location.origin}/song/${song.id}${sourceSuffix}`;
        const shareData = {
            title: `Listen to ${song.name}`,
            text: `Check out this song on Muse: ${song.name} by ${song.artist}`,
            url: url
        };
        
        // 1. Try Native Share (Mobile)
        if (navigator.share) {
            try { 
                await navigator.share(shareData); 
                return;
            } catch(e) {
                console.log("Native share cancelled/failed", e);
                return;
            }
        } 
    
        // 2. Try Clipboard API
        const copyToClipboard = async (text: string) => {
            if (!navigator.clipboard) return false;
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                return false;
            }
        };
    
        // 3. Legacy Fallback
        const fallbackCopy = (text: string) => {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed"; 
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (err) {
                console.error('Fallback copy failed:', err);
                return false;
            }
        };
    
        if (await copyToClipboard(url) || fallbackCopy(url)) {
            setCopiedId(song.id);
            setTimeout(() => setCopiedId(null), 2000);
        } else {
            prompt("Copy link:", url);
        }
    };

    return (
        <div 
          data-song-id={song.id}
          className="h-[100dvh] w-full snap-start snap-always flex items-center justify-center relative border-b border-white/5 overflow-hidden"
          onClick={() => {
              // Tap anywhere to toggle play on mobile (since we removed the button)
              if (isActive) {
                  togglePlay();
              } else {
                  onPlay();
              }
          }}
        >
          {/* Background Blur */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl"
            style={{ backgroundImage: `url(${song.image[0]})` }}
          />
    
          {/* Share Button - Top Right (Fixed Position relative to screen, but scoped to card for snap) */}
          {/* We use absolute here because the parent is relative and full screen height */}
          <button 
            onClick={(e) => {
                e.stopPropagation(); // Prevent toggling play
                handleShare();
            }}
            className="absolute top-6 right-6 z-30 p-2.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95"
          >
              {copiedId === song.id ? (
                  <Check className="w-5 h-5 text-green-400" />
              ) : (
                  <Share2 className="w-5 h-5" />
              )}
              
             {/* Toast Notification */}
             {copiedId === song.id && (
                <div className="absolute top-12 right-0 bg-green-500 text-black text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg">
                    Copied!
                </div>
             )}
          </button>
    
          {/* Content */}
          <div className="relative z-10 w-full max-w-md p-6 flex flex-col items-center justify-center h-full pb-20 pointer-events-none"> 
             {/* pointer-events-none so click passes to parent for play/pause */}
             <img 
                src={typeof song.image?.[0] === 'string' && song.image[0].trim() !== '' ? song.image[0] : '/logo.png'} 
                onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.png';
                }}
                alt={song.name} 
                className="w-[80vw] h-[80vw] max-w-[320px] max-h-[320px] rounded-2xl shadow-2xl mb-8 object-cover aspect-square"
             />
             
             <div className="w-full text-center space-y-1">
                <h2 className="text-2xl font-bold text-white leading-tight">{song.name}</h2>
                <p className="text-lg text-gray-400 font-medium">{song.artist}</p>
             </div>
             
             {/* Playback Status for Mobile (since no button) */}
             {!isPlaying && isActive && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
                     <Play className="w-16 h-16 text-white/80 fill-white/80 opacity-80" />
                 </div>
             )}
          </div>
        </div>
      );
}
