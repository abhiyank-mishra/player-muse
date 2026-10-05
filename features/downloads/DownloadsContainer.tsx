"use client";
import React from 'react';
import { useDownloadsLogic } from './useDownloadsLogic';
import DownloadsUI from './DownloadsUI';
import { DownloadsActions } from './downloads.types';

export default function DownloadsContainer() {
  const { state, actions } = useDownloadsLogic();
  
  return <DownloadsUI state={state} actions={actions as unknown as DownloadsActions} />;
}
