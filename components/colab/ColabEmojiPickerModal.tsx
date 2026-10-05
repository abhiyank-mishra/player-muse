"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Sparkles, Smile, Music, ThumbsUp, Heart, Zap } from 'lucide-react';

interface ColabEmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: any;
  emojis: { emoji: string; keywords: string }[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'trending',
    name: 'Trending',
    icon: Sparkles,
    emojis: [
      { emoji: '🔥', keywords: 'fire hot lit burn trending' },
      { emoji: '❤️', keywords: 'heart love red' },
      { emoji: '💃', keywords: 'dance dancing woman girl salsa' },
      { emoji: '🎧', keywords: 'headphones music audio listen sound' },
      { emoji: '⚡', keywords: 'lightning zap electric bolt power' },
      { emoji: '🎉', keywords: 'party celebrate tada confetti celebration' },
      { emoji: '🚀', keywords: 'rocket blast launch speed' },
      { emoji: '👏', keywords: 'clap applause bravo cheering' },
      { emoji: '🎶', keywords: 'music notes song melody' },
      { emoji: '🎵', keywords: 'musical note song' },
      { emoji: '💯', keywords: 'hundred 100 perfect score real' },
      { emoji: '✨', keywords: 'sparkles shine star glitter magic' },
      { emoji: '🤩', keywords: 'star eyes excited wow amazed' },
      { emoji: '😎', keywords: 'cool sunglasses chill boss' },
      { emoji: '🥰', keywords: 'love hearts smile blush' },
      { emoji: '🤯', keywords: 'mind blown explosion shocked' },
    ],
  },
  {
    id: 'faces',
    name: 'Faces',
    icon: Smile,
    emojis: [
      { emoji: '😂', keywords: 'joy laugh funny cry tears laughing' },
      { emoji: '🤣', keywords: 'rofl rolling floor laughing funny' },
      { emoji: '🥹', keywords: 'pleading touched grateful eyes tears happy' },
      { emoji: '😍', keywords: 'heart eyes love crush' },
      { emoji: '🥳', keywords: 'party celebrating happy horn' },
      { emoji: '🤤', keywords: 'drool delicious taste yummy' },
      { emoji: '😭', keywords: 'sob crying sad tears loud' },
      { emoji: '💀', keywords: 'skull dead dying laugh skeleton' },
      { emoji: '🫠', keywords: 'melting melt heat awkward' },
      { emoji: '🫡', keywords: 'salute yes sir respect' },
      { emoji: '🤔', keywords: 'thinking think wonder hmm' },
      { emoji: '🥺', keywords: 'pleading puppy eyes sad please' },
      { emoji: '😜', keywords: 'wink tongue silly crazy fun' },
      { emoji: '🤐', keywords: 'zipper mouth secret quiet silent' },
      { emoji: '😴', keywords: 'sleep sleeping tired sleepy' },
      { emoji: '😇', keywords: 'angel halo innocent good' },
      { emoji: '🤠', keywords: 'cowboy hat yeehaw western' },
      { emoji: '🥵', keywords: 'hot heat sweating flushed' },
      { emoji: '🥶', keywords: 'cold freezing ice freeze' },
      { emoji: '😱', keywords: 'scream scared afraid shock' },
      { emoji: '🤫', keywords: 'shh quiet secret hush' },
      { emoji: '🤭', keywords: 'giggle oops hand over mouth' },
      { emoji: '😈', keywords: 'devil naughty wicked purple' },
      { emoji: '👀', keywords: 'eyes look look at see peek' },
    ],
  },
  {
    id: 'music',
    name: 'Music & Vibes',
    icon: Music,
    emojis: [
      { emoji: '🎸', keywords: 'guitar rock electric music' },
      { emoji: '🎹', keywords: 'piano keys keyboard jazz classical' },
      { emoji: '🥁', keywords: 'drum beat percussion rhythm' },
      { emoji: '🎷', keywords: 'saxophone jazz brass horn' },
      { emoji: '🎺', keywords: 'trumpet brass fanfare' },
      { emoji: '🎤', keywords: 'microphone mic sing singer karaoke' },
      { emoji: '🎙️', keywords: 'studio mic podcast recording' },
      { emoji: '🔊', keywords: 'speaker loud volume sound' },
      { emoji: '📻', keywords: 'radio broadcast fm stream' },
      { emoji: '🪩', keywords: 'disco ball dance club party glitter' },
      { emoji: '🕺', keywords: 'dancer man dancing groove' },
      { emoji: '🎼', keywords: 'score sheet music clef' },
      { emoji: '🎻', keywords: 'violin strings orchestra' },
      { emoji: '🪕', keywords: 'banjo folk bluegrass' },
      { emoji: '🥂', keywords: 'cheers champagne glasses toast' },
      { emoji: '🍻', keywords: 'beer mugs cheers pub drink' },
      { emoji: '🍹', keywords: 'tropical drink cocktail vacation' },
      { emoji: '🍿', keywords: 'popcorn movie snack cinema' },
      { emoji: '🎇', keywords: 'sparkler fireworks night' },
      { emoji: '🎆', keywords: 'fireworks celebration sky' },
    ],
  },
  {
    id: 'hands',
    name: 'Hands',
    icon: ThumbsUp,
    emojis: [
      { emoji: '👍', keywords: 'thumbs up like good yes approve' },
      { emoji: '👎', keywords: 'thumbs down dislike bad no' },
      { emoji: '✌️', keywords: 'peace victory two v sign' },
      { emoji: '🤘', keywords: 'rock on metal horns heavy' },
      { emoji: '🤙', keywords: 'call me shaka hang loose' },
      { emoji: '👊', keywords: 'fist bump punch bro' },
      { emoji: '🤝', keywords: 'handshake deal agree partner' },
      { emoji: '🙏', keywords: 'pray please thanks namaste grateful' },
      { emoji: '💪', keywords: 'muscle strong flex power fitness' },
      { emoji: '🫶', keywords: 'heart hands love care' },
      { emoji: '👋', keywords: 'wave hello hi goodbye bye' },
      { emoji: '🖖', keywords: 'vulcan spock live long prosper' },
      { emoji: '👌', keywords: 'ok okay perfect fine' },
      { emoji: '🤌', keywords: 'pinched fingers italian chef kiss' },
      { emoji: '🫰', keywords: 'finger heart kpop love snap' },
      { emoji: '🫂', keywords: 'hug people embrace comfort' },
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: Heart,
    emojis: [
      { emoji: '❤️', keywords: 'red heart love passion' },
      { emoji: '💖', keywords: 'sparkle heart love glitter shiny' },
      { emoji: '💗', keywords: 'growing heart love pulse' },
      { emoji: '💓', keywords: 'beating heart love vibration' },
      { emoji: '💞', keywords: 'revolving hearts love spin' },
      { emoji: '💕', keywords: 'two hearts pink love' },
      { emoji: '💘', keywords: 'heart arrow cupid shot' },
      { emoji: '💌', keywords: 'love letter mail envelope heart' },
      { emoji: '🧡', keywords: 'orange heart love warm' },
      { emoji: '💛', keywords: 'yellow heart friendship warm' },
      { emoji: '💚', keywords: 'green heart nature jealous' },
      { emoji: '💙', keywords: 'blue heart trust cool' },
      { emoji: '💜', keywords: 'purple heart royal' },
      { emoji: '🖤', keywords: 'black heart dark emo gothic' },
      { emoji: '🤍', keywords: 'white heart pure peace' },
      { emoji: '🤎', keywords: 'brown heart chocolate' },
      { emoji: '💔', keywords: 'broken heart heartbreak sad split' },
      { emoji: '❤️‍🔥', keywords: 'heart on fire passion intense' },
      { emoji: '❤️‍🩹', keywords: 'mending heart healing recovering' },
    ],
  },
  {
    id: 'symbols',
    name: 'Fun & Symbols',
    icon: Zap,
    emojis: [
      { emoji: '💥', keywords: 'boom collision explosion bang' },
      { emoji: '💫', keywords: 'dizzy star spark swirl' },
      { emoji: '💣', keywords: 'bomb explosive danger' },
      { emoji: '🏆', keywords: 'trophy winner prize gold first' },
      { emoji: '👑', keywords: 'crown king queen royal champion' },
      { emoji: '💎', keywords: 'gem diamond luxury precious rich' },
      { emoji: '🌈', keywords: 'rainbow colors pride weather' },
      { emoji: '☀️', keywords: 'sun sunny bright warm day' },
      { emoji: '🌙', keywords: 'moon crescent night sleep' },
      { emoji: '⭐', keywords: 'star yellow rating favorite' },
      { emoji: '☕', keywords: 'coffee tea hot cup caffeine' },
      { emoji: '🍦', keywords: 'ice cream sweet dessert summer' },
      { emoji: '🍕', keywords: 'pizza slice cheese food' },
      { emoji: '🍔', keywords: 'burger hamburger fast food' },
      { emoji: '🌸', keywords: 'cherry blossom flower pink spring' },
      { emoji: '🍀', keywords: 'clover four leaf lucky luck' },
      { emoji: '🧿', keywords: 'nazar evil eye amulet protection' },
      { emoji: '🪄', keywords: 'magic wand wizard spell' },
    ],
  },
];

export default function ColabEmojiPickerModal({
  isOpen,
  onClose,
  onSelectEmoji,
}: ColabEmojiPickerModalProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('trending');

  // Filter emojis based on search keyword
  const filteredEmojis = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;

    const results: string[] = [];
    const seen = new Set<string>();

    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (!seen.has(item.emoji) && (item.emoji.includes(q) || item.keywords.includes(q))) {
          seen.add(item.emoji);
          results.push(item.emoji);
        }
      }
    }
    return results;
  }, [search]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
        {/* Backdrop click to close */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative w-full sm:max-w-md max-h-[85vh] sm:max-h-[580px] bg-[#141416] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Send Live Reaction</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search all emojis (fire, love, clap, guitar...)"
                autoFocus
                className="w-full bg-white/[0.04] border border-white/10 focus:border-purple-500/50 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Categories Tab Selector (Hidden during active search) */}
          {!search && (
            <div className="px-4 py-1.5 flex items-center gap-1 overflow-x-auto hide-scrollbar border-b border-white/5 shrink-0">
              {EMOJI_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Emojis Grid Area */}
          <div className="p-4 flex-1 overflow-y-auto hide-scrollbar">
            {search ? (
              // Search Results
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
                  Search Results ({filteredEmojis?.length || 0})
                </p>
                {filteredEmojis && filteredEmojis.length > 0 ? (
                  <div className="grid grid-cols-6 sm:grid-cols-7 gap-2">
                    {filteredEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onSelectEmoji(emoji);
                          onClose();
                        }}
                        className="w-11 h-11 rounded-xl bg-white/[0.03] hover:bg-white/[0.12] active:scale-90 border border-white/5 hover:border-purple-500/30 text-2xl flex items-center justify-center transition-all cursor-pointer hover:shadow-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    No matching emojis found for &ldquo;{search}&rdquo;
                  </div>
                )}
              </div>
            ) : (
              // Category View
              <div>
                {EMOJI_CATEGORIES.filter((c) => c.id === activeCategory).map((cat) => (
                  <div key={cat.id}>
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                      {cat.name}
                    </p>
                    <div className="grid grid-cols-6 sm:grid-cols-7 gap-2">
                      {cat.emojis.map((item) => (
                        <button
                          key={item.emoji}
                          onClick={() => {
                            onSelectEmoji(item.emoji);
                            onClose();
                          }}
                          className="w-11 h-11 rounded-xl bg-white/[0.03] hover:bg-white/[0.12] active:scale-90 border border-white/5 hover:border-purple-500/30 text-2xl flex items-center justify-center transition-all cursor-pointer hover:shadow-lg"
                          title={item.keywords}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer tip */}
          <div className="px-4 py-2.5 bg-black/30 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
            <span>Tap any emoji to float live in room</span>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
