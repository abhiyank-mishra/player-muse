# Development Rules & Architectural Principles (Muse Music)

Yeh rules future me kisi bhi development ya refactoring ke dauran strictly follow karne hain:

## 1. No Blind Code Rewrites (Functionality Preservation)
- Codebase me har component (khaaskar Player, Contexts, aur Search) me multiple nested functions, audio engines, background tasks aur state sync logic jude hue hain.
- Kisi bhi file ko bina uske poore lifecycle aur dependencies ko samjhe direct rewrite ya delete nahi karna hai.
- Agar sirf UI change karni hai, toh sirf layout/CSS/JSX repositioning karni hai. Existing callbacks, event handlers (`onPlay`, `onSeek`, `onLike`, `onDownload`, `onPlaylistClick`, modals) ko intact rakhna hai.

## 2. Audio Engine & Background Playback Integrity
- Mobile browsers (iOS Safari / Android Chrome) background me audio kill na karein, iske liye `BackgroundKeepAlive`, `MediaSessionBridge`, aur `WakeLockManager` jude hain. Inke hooks ko kabhi bypass nahi karna.
- Audio seek handling smooth rahe iske liye `localSeek` aur `isDragging` state sync ko disturb nahi karna.

## 3. Image & Metadata Handling
- SoundCloud aur JioSaavn ke images alag format me aate hain (SoundCloud me kabhi `artwork_url` null hota hai toh `user.avatar_url` fallback zaroori hai).
- Image containers me hamesha `shrink-0 aspect-square rounded-lg` use karna hai taaki image horizontally squeeze ya stretch ho kar "pill" shape na bane.

## 4. Multi-Source Search & Ranking
- Search me JioSaavn aur SoundCloud dono se results aate hain.
- Title match high hone par kabhi bhi low plays ki wajah se underrated tracks ko penalize nahi karna.
- SoundCloud ke native top rank ko preserve rakhna hai.

## 5. Verification Before Delivery
- Har code change ke baad:
  1. `npx tsc --noEmit` (0 errors required)
  2. `npx next build` (build verification)
  3. Live API / UI checks before reporting to user.

## 6. Minimal Dark Aesthetic (No "Satrangi" Colors / Over-Styling)
- App ka theme strictly minimal dark glass hai (`bg-[#121214]`, `bg-white/[0.02]`, subtle `border-white/10`).
- Components me baar-baar alag-alag flashy saturated colors (loud purple, pink, etc.) add karke unko "satrangi" nahi banana hai.
- Consistent neutral dark aesthetic maintain karni hai, taaki components seamless dikhein aur eye-straining contrast na bane.

## 7. Concise UI Copy & Compact Controls (No Over-Words)
- UI text hamesha short, direct aur clean hona chahiye. Faltu ke lambe labels ya robotic parenthetical text (e.g. "UP NEXT (AUTOPLAY RADIO)") avoid karein — simple "Next" ya "Up Next" use karein.
- Buttons hamesha compact, single-line (`whitespace-nowrap`) hone chahiye. Button text kabhi vertical split hokar break nahi hona chahiye (e.g. "Play \n Now").

