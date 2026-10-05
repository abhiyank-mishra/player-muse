
"use client";
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full pt-20 pb-10 mt-auto">
        <div className="flex flex-col items-center justify-center gap-4 text-center px-4">
            <p className="text-[10px] md:text-xs text-gray-600 max-w-md leading-relaxed">
                Muse uses the API for music metadata and streaming. Built with Next.js and Tailwind CSS. by Abhiyank.
            </p>
            <div className="flex gap-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                <Link href="/privacy" className="hover:text-purple-400 transition-colors">Privacy Policy</Link>
                <span>•</span>
                <Link href="/privacy" className="hover:text-purple-400 transition-colors">Terms of Service</Link>
            </div>
        </div>
    </footer>
  );
}
