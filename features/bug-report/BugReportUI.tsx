"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Send, X, Terminal } from 'lucide-react';
import Spinner from '@/reusable/animations/loading/Spinner';

interface BugReportUIProps {
  isOpen: boolean;
  isSubmitting: boolean;
  comment: string;
  setComment: (val: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function BugReportUI({
  isOpen,
  isSubmitting,
  comment,
  setComment,
  onClose,
  onSubmit
}: BugReportUIProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="bg-[#121212] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h2 className="text-xl font-bold text-white">Report a Bug</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-gray-400 text-sm mb-6">
            You shook your device! Did you find a bug? Let us know what happened. Behind the scenes, we automatically grab system logs, console errors, and the current song info.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">What went wrong? (Optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., The song isn't playing..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none resize-vertical"
            />
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center gap-3 mb-6">
            <Terminal className="w-5 h-5 text-purple-400" />
            <div className="text-xs text-gray-400">
              <span className="text-white font-medium">Auto-capturing:</span> Player State, Error Logs, Device Info.
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="w-5 h-5 text-white" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
