"use client";

import React, { Suspense } from 'react';
import HomeContainer from '@/features/home/HomeContainer';
import Spinner from '@/reusable/animations/loading/Spinner';

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Spinner className="w-8 h-8 text-purple-500" /></div>}>
      <HomeContainer />
    </Suspense>
  );
}
