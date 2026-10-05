"use client";
import React from 'react';
import { useSearchLogic } from './useSearchLogic';
import SearchUI from './SearchUI';

export default function SearchContainer() {
  const { state, actions } = useSearchLogic();
  
  return <SearchUI state={state} actions={actions} />;
}
