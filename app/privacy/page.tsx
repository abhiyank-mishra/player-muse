
"use client";
import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck, Heart } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen p-6 md:p-12 max-w-3xl mx-auto pb-32">
      <Link 
        href="/" 
        className="mb-12 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Back to Muse
      </Link>

      <header className="mb-12">
        <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/30">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">Privacy Policy</h1>
        <p className="text-gray-500">Last updated: February 2026</p>
      </header>

      <div className="space-y-10 prose prose-invert max-w-none">
        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-500 rounded-full" />
            Introduction
          </h2>
          <p className="text-gray-400 leading-relaxed">
            Muse is a hobby project created by **Abhiyank** for personal and educational purposes. 
            This app provides a premium, ad-free music experience by leveraging public APIs.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-pink-500 rounded-full" />
            Data Usage & Sources
          </h2>
          <p className="text-gray-400 leading-relaxed mb-4">
            We value your privacy. Muse does not store your personal search history or private data on our servers. 
            However, we use several third-party services to provide the best experience:
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2">
            <li><strong>JioSaavn API</strong>: Used for music metadata, search results, and high-quality streaming links.</li>
            <li><strong>Next.js & Vercel</strong>: Our core framework and hosting provider.</li>
            <li><strong>Tailwind CSS</strong>: Used for the premium design and interface.</li>
          </ul>
        </section>

        <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                Disclaimer
            </h2>
            <p className="text-gray-400 leading-relaxed">
                All music content, images, and artist metadata are the property of their respective owners (JioSaavn and related labels). 
                Muse does not claim ownership over any of the media served through the app.
            </p>
        </section>

        <footer className="pt-10 border-t border-white/5">
             <div className="flex items-center gap-2 text-gray-500 text-sm">
                <span>Made with</span>
                <Heart className="w-4 h-4 text-pink-500 fill-current" />
                <span>by Abhiyank</span>
             </div>
        </footer>
      </div>
    </div>
  );
}
