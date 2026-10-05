"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useColab } from '@/contexts/ColabContext';

export default function FloatingReactionsOverlay() {
  const { floatingReactions } = useColab();

  if (floatingReactions.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <AnimatePresence>
        {floatingReactions.map((reaction) => {
          // Stable offset derived from reaction.id so items never jump mid-air when older reactions expire
          let hash = 0;
          for (let i = 0; i < reaction.id.length; i++) {
            hash = (hash << 5) - hash + reaction.id.charCodeAt(i);
            hash |= 0;
          }
          const randomX = (Math.abs(hash) % 80) - 40;
          const randomRotation = (Math.abs(hash >> 3) % 30) - 15;
          const driftDir = hash % 2 === 0 ? 1 : -1;

          return (
            <motion.div
              key={reaction.id}
              initial={{ 
                opacity: 0, 
                scale: 0.4, 
                y: 30, 
                x: randomX 
              }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1.35, 1.15, 0.85],
                y: -420,
                x: randomX + (driftDir * 25),
                rotate: randomRotation
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 2.8, 
                ease: "easeOut" 
              }}
              className="absolute bottom-28 md:bottom-24 right-8 sm:right-16 md:right-20 flex flex-col items-center gap-1 select-none"
            >
              <span className="text-3xl md:text-5xl filter drop-shadow-lg">
                {reaction.emoji}
              </span>
              <span className="text-[10px] bg-black/75 backdrop-blur-md text-white/90 px-2.5 py-0.5 rounded-full border border-white/10 shadow-lg whitespace-nowrap font-medium">
                {reaction.userName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
