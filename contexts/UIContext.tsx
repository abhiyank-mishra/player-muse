"use client";

import React, { createContext, useContext, useState } from 'react';

import { Song } from '@/lib/types';

interface UIContextType {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isProModalOpen: boolean;
  setProModalOpen: (open: boolean) => void;
  isNameModalOpen: boolean;
  setNameModalOpen: (open: boolean) => void;
  playlistModalSong: Song | null;
  openAddToPlaylist: (song: Song) => void;
  closeAddToPlaylist: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isProModalOpen, setProModalOpen] = useState(false);
  const [isNameModalOpen, setNameModalOpen] = useState(false);
  const [playlistModalSong, setPlaylistModalSong] = useState<Song | null>(null);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  const openAddToPlaylist = (song: Song) => {
    setPlaylistModalSong(song);
  };

  const closeAddToPlaylist = () => {
    setPlaylistModalSong(null);
  };

  return (
    <UIContext.Provider value={{ 
      isSidebarOpen, setSidebarOpen, toggleSidebar,
      isProModalOpen, setProModalOpen,
      isNameModalOpen, setNameModalOpen,
      playlistModalSong, openAddToPlaylist, closeAddToPlaylist
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
