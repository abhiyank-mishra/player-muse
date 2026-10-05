
"use client";
import React from 'react';
import Link from 'next/link';
import { Music, Home, Search, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 bg-purple-600 blur-[100px] opacity-20 -z-10" />
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-2xl">
          <Music className="w-16 h-16 md:w-24 md:h-24 text-white animate-pulse" />
        </div>
        <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-4 border border-dashed border-purple-500/30 rounded-full"
        />
      </motion.div>

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tighter"
      >
        404
      </motion.h1>
      
      <motion.h2 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xl md:text-2xl font-bold text-gray-300 mb-8 max-w-md mx-auto leading-tight"
      >
        Oops! This track isn't on the <span className="text-purple-400">Muse</span> playlist.
      </motion.h2>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col md:flex-row gap-4 justify-center items-center"
      >
        <Link 
          href="/" 
          className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl"
        >
          <Home className="w-5 h-5" /> Back to Home
        </Link>
        <Link 
          href="/?reset=true" 
          className="flex items-center gap-2 px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-colors"
        >
          <Search className="w-5 h-5" /> Search Music
        </Link>
      </motion.div>

      <motion.div 
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         transition={{ delay: 0.6 }}
         className="mt-16 flex items-center gap-2 text-gray-500 text-sm"
      >
          <span className="w-8 h-[1px] bg-gray-800" />
          <span>Muse Premium</span>
          <span className="w-8 h-[1px] bg-gray-800" />
      </motion.div>
    </div>
  );
}
