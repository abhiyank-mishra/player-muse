"use client";
import React from 'react';
import { usePlaylistLogic } from './usePlaylistLogic';
import PlaylistUI from './PlaylistUI';

export default function PlaylistContainer() {
  const { state, actions } = usePlaylistLogic();
  
  return <PlaylistUI state={state} actions={actions} />;
}
