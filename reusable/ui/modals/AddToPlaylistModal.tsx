
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddToPlaylistModalProps {
    isOpen: boolean;
    playlists: any[];
    addingToId: string | null;
    onAddToPlaylist: (id: string, e: React.MouseEvent) => void;
    onClose: () => void; // Added
    positionClass?: string;
}

export default function AddToPlaylistModal({
    isOpen,
    playlists,
    addingToId,
    onAddToPlaylist,
    onClose, // Added
    positionClass = "absolute bottom-14 right-0"
}: AddToPlaylistModalProps) {
    const modalRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Capture logic is important here to avoid race condition with the opening click
        // But bubbling phase is standard.
        // We need to stop propagation on the trigger button, which is already done in handlePlaylistClick (e.stopPropagation())
        
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    ref={modalRef}
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className={`${positionClass} min-w-[14rem] bg-[#18181b]/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-2xl z-50 flex flex-col gap-1`}
                    style={{ maxWidth: '90vw' }}
                >
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Save to Playlist</p>
                    {playlists.length > 0 ? (
                        playlists.map(p => (
                        <button 
                            key={p.id}
                            disabled={addingToId === p.id}
                            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(p.id, e); }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-white text-sm transition-colors disabled:opacity-50"
                        >
                            {addingToId === p.id ? 'Adding...' : p.name}
                        </button>
                        ))
                    ) : (
                        <p className="text-gray-500 text-xs px-2 py-1">No playlists yet</p>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
