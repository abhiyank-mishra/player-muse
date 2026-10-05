import React, { Suspense } from 'react';
import SearchContainer from '@/features/search/SearchContainer';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SearchContainer />
    </Suspense>
  );
}
