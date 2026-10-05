"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Home, Music, Headphones } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("App boundary caught an error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center max-w-md w-full relative z-10"
      >
        {/* Animated music icon */}
        <div className="relative mb-8">
          <motion.div
            animate={{ rotate: [0, -5, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center shadow-2xl"
          >
            <Headphones className="w-12 h-12 text-purple-400" />
          </motion.div>
          {/* Floating music notes */}
          <motion.div
            animate={{ y: [-5, -15, -5], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-2 -right-2"
          >
            <Music className="w-5 h-5 text-purple-400/50" />
          </motion.div>
          <motion.div
            animate={{ y: [-3, -12, -3], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            className="absolute -top-1 -left-3"
          >
            <Music className="w-4 h-4 text-blue-400/40" />
          </motion.div>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 bg-gradient-to-br from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          Took a wrong note
        </h1>
        <h2 className="text-base md:text-lg font-medium text-gray-400 mb-6">
          Something went off-beat temporarily
        </h2>
        
        <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
          The music will resume shortly. Try refreshing the page or head back to the home screen.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full mb-6">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/10 hover:shadow-purple-500/20 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
          
          <Link 
            href="/"
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all active:scale-95"
            onClick={() => reset()}
          >
            <Home className="w-4 h-4" />
            <span>Go Home</span>
          </Link>
        </div>

        {/* Error details toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] text-gray-600 hover:text-gray-400 font-bold uppercase tracking-widest transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Error Details'}
        </button>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 w-full bg-white/5 border border-white/5 rounded-xl p-3 text-left overflow-hidden"
          >
            <p className="text-[10px] text-red-400/70 font-mono break-all leading-relaxed">
              {error.message || 'Unknown error'}
            </p>
            {error.digest && (
              <p className="text-[9px] text-gray-600 font-mono mt-1">ID: {error.digest}</p>
            )}
          </motion.div>
        )}

        {/* Branding */}
        <div className="mt-10 flex items-center gap-2 opacity-20">
          <img src="/logo.png" alt="Muse" className="w-5 h-5 rounded" />
          <span className="text-xs font-bold text-gray-400">Muse Music</span>
        </div>
      </motion.div>
    </div>
  );
}
