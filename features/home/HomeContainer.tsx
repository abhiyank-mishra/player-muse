"use client";
import React from 'react';
import { useHomeLogic } from './useHomeLogic';
import HomeUI from './HomeUI';

export default function HomeContainer() {
  const { state, actions } = useHomeLogic();
  
  return <HomeUI state={state} actions={actions} />;
}
