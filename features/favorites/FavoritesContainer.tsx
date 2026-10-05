"use client";
import React from 'react';
import { useFavoritesLogic } from './useFavoritesLogic';
import FavoritesUI from './FavoritesUI';

export default function FavoritesContainer() {
  const { state, actions } = useFavoritesLogic();
  
  return <FavoritesUI state={state} actions={actions} />;
}
