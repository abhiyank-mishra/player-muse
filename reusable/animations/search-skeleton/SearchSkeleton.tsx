import React from 'react';

export default function SearchSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4 w-full">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-xl animate-pulse bg-white/5 h-20 w-full animate-in fade-in zoom-in duration-300"></div>
      ))}
    </div>
  );
}
