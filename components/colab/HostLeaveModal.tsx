"use client";

import React from 'react';
import { X, LogOut, Power, UserCheck } from 'lucide-react';

interface HostLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeaveAndTransfer: () => void;
  onTerminate: () => void;
  nextHostName?: string;
  hasOtherMembers: boolean;
}

export default function HostLeaveModal({
  isOpen,
  onClose,
  onLeaveAndTransfer,
  onTerminate,
  nextHostName,
  hasOtherMembers,
}: HostLeaveModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-zinc-300" />
            <h3 className="text-sm font-semibold text-white">Leave Colab Session</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        {hasOtherMembers ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-400">
              You are the Host. Choose what happens to this session:
            </p>

            {/* Option 1: Leave & Transfer Host */}
            <button
              onClick={() => {
                onClose();
                onLeaveAndTransfer();
              }}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition-colors text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-white shrink-0 mt-0.5">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Leave & Transfer Host</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  Pass host controls to <span className="text-zinc-200 font-medium">{nextHostName || 'next member'}</span>. You can rejoin later as a listener.
                </p>
              </div>
            </button>

            {/* Option 2: Terminate Session */}
            <button
              onClick={() => {
                onClose();
                onTerminate();
              }}
              className="flex items-start gap-3 p-3 rounded-xl bg-red-500/[0.04] hover:bg-red-500/[0.08] border border-red-500/15 hover:border-red-500/25 transition-colors text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <Power className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-300">Terminate Session</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  End the session immediately for all participants.
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-400">
              You are the only member in this room. Leaving will end the session.
            </p>
            <button
              onClick={() => {
                onClose();
                onTerminate();
              }}
              className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              End Session
            </button>
          </div>
        )}

        {/* Footer: Cancel */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
