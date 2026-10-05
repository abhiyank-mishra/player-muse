"use client";
import React from 'react';
import { useExploreLogic } from './useExploreLogic';
import ExploreUI from './ExploreUI';
import { ExploreActions } from './explore.types';

export default function ExploreContainer() {
  const { state, actions } = useExploreLogic();
  
  return <ExploreUI state={state} actions={actions as unknown as ExploreActions} />;
}
