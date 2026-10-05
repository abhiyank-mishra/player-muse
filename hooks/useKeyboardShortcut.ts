"use client";
import { useEffect } from 'react';

type ModifierKey = 'ctrl' | 'meta' | 'ctrlOrMeta' | 'shift' | 'alt';

interface ShortcutOptions {
  key: string;
  modifiers?: ModifierKey[];
  preventDefault?: boolean;
  onTrigger: () => void;
}

/**
 * Registers a global keyboard shortcut on `window`.
 * Automatically cleaned up when the component unmounts.
 */
export function useKeyboardShortcut({ key, modifiers = [], preventDefault = true, onTrigger }: ShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrlOrMeta = modifiers.includes('ctrlOrMeta') ? (e.ctrlKey || e.metaKey) : true;
      const ctrl = modifiers.includes('ctrl') ? e.ctrlKey : true;
      const meta = modifiers.includes('meta') ? e.metaKey : true;
      const shift = modifiers.includes('shift') ? e.shiftKey : true;
      const alt = modifiers.includes('alt') ? e.altKey : true;

      const allMet = ctrlOrMeta && ctrl && meta && shift && alt;

      if (allMet && e.key === key) {
        if (preventDefault) e.preventDefault();
        onTrigger();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, modifiers, preventDefault, onTrigger]);
}
