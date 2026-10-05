import { Song } from '@/lib/types';
import { ColabMember, ColabQueueItem } from '@/lib/colabTypes';

interface BlendOptions {
  currentSong: Song | null;
  members: ColabMember[];
  dismissedIds?: Set<string>;
  limit?: number;
}

const blendCache = new Map<string, { timestamp: number; items: ColabQueueItem[] }>();
const CACHE_TTL_MS = 45000; // 45 seconds

export class ColabBlendGenerator {
  /**
   * Generates a blended multi-user upcoming queue based on all room members' musical tastes.
   * Round-robin interleaves: Member 1 → Member 2 → Shared Blend → Member 1 → ...
   */
  static async generateBlend({
    currentSong,
    members,
    dismissedIds = new Set(),
    limit = 7,
  }: BlendOptions): Promise<ColabQueueItem[]> {
    if (!currentSong?.id) return [];

    const memberList = (members || []).filter(Boolean);
    const memberProfiles = memberList
      .map((m) => ({
        id: m.id,
        name: m.name,
        profile: m.tasteProfile,
      }))
      .filter((m) => m.profile && (m.profile.topArtists?.length > 0 || m.profile.recentSeedIds?.length > 0));

    // Cache key based on current song, member IDs, and their taste profile signatures
    const memberFingerprint = memberList
      .map((m) => {
        const artists = m.tasteProfile?.topArtists?.slice(0, 3).join(',') || 'none';
        const seeds = m.tasteProfile?.recentSeedIds?.slice(0, 2).join(',') || 'none';
        return `${m.id}:${artists}:${seeds}`;
      })
      .sort()
      .join('__');
    const cacheKey = `${currentSong.id}_${memberFingerprint}`;
    const cached = blendCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      // Filter out any newly dismissed IDs from cached items
      return cached.items.filter((item) => !dismissedIds.has(item.song.id));
    }

    try {
      // ── Step 1: Base Recommendations for current song ──
      const isYouTube = currentSong.source === 'youtube';
      const baseRecsPromise = isYouTube
        ? fetch(`/api/music/recommendations/youtube?name=${encodeURIComponent(currentSong.name)}&artist=${encodeURIComponent(currentSong.artist?.split(',')[0]?.trim() || '')}&limit=15&resolve=true`)
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => (Array.isArray(data) ? data : []))
            .catch(() => [])
        : fetch(`/api/music/recommendations?id=${currentSong.id}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => (Array.isArray(data) ? data : data?.data || data?.results || []))
            .catch(() => []);

      // ── Step 2: Per-Member Artist / Seed Searches ──
      const memberSearchPromises = memberProfiles.map(async (member) => {
        const topArtist = member.profile?.topArtists?.[0];
        if (!topArtist) return { member, songs: [] };

        try {
          const res = await fetch(`/api/music/search?query=${encodeURIComponent(topArtist)}&limit=10`);
          if (res.ok) {
            const data = await res.json();
            const songs = Array.isArray(data) ? data : data.songs || [];
            return { member, songs };
          }
        } catch {
          // ignore
        }
        return { member, songs: [] };
      });

      const [baseRecs, memberSearchResults] = await Promise.all([
        baseRecsPromise,
        Promise.all(memberSearchPromises),
      ]);

      // ── Step 3: Identify Shared Artists & Languages ──
      const allArtistLists = memberProfiles.map((m) => new Set(m.profile?.topArtists?.map((a) => a.toLowerCase()) || []));
      const sharedArtists = new Set<string>();
      if (allArtistLists.length >= 2) {
        for (const artist of allArtistLists[0]) {
          if (allArtistLists.slice(1).some((set) => set.has(artist))) {
            sharedArtists.add(artist);
          }
        }
      }

      // ── Step 4: Round-Robin Assembly ──
      const seenIds = new Set<string>([currentSong.id, ...Array.from(dismissedIds)]);
      const seenNames = new Set<string>([this.normalizeTitle(currentSong.name)]);
      const blendedQueue: ColabQueueItem[] = [];

      // If we don't have multiple profiles, fall back to base recommendations
      if (memberProfiles.length < 2) {
        for (const song of baseRecs) {
          if (!song || !song.id) continue;
          if (seenIds.has(song.id)) continue;
          const normTitle = this.normalizeTitle(song.name);
          if (seenNames.has(normTitle)) continue;

          seenIds.add(song.id);
          seenNames.add(normTitle);
          blendedQueue.push({
            song,
            isManual: false,
          });

          if (blendedQueue.length >= limit) break;
        }
        blendCache.set(cacheKey, { timestamp: Date.now(), items: blendedQueue });
        return blendedQueue;
      }

      // We have 2+ members! Interleave turn-by-turn
      const memberPools = memberSearchResults.map(({ member, songs }) => ({
        member,
        songs: songs.filter((s: Song) => s && s.id && !seenIds.has(s.id)),
        cursor: 0,
      }));

      let baseRecsCursor = 0;
      let turnIndex = 0;

      while (blendedQueue.length < limit) {
        const poolIndex = turnIndex % (memberPools.length + 1);

        if (poolIndex < memberPools.length) {
          // Member's Turn
          const pool = memberPools[poolIndex];
          let chosenSong: Song | null = null;

          while (pool.cursor < pool.songs.length) {
            const candidate = pool.songs[pool.cursor++];
            const normTitle = this.normalizeTitle(candidate.name);
            if (!seenIds.has(candidate.id) && !seenNames.has(normTitle)) {
              chosenSong = candidate;
              seenIds.add(candidate.id);
              seenNames.add(normTitle);
              break;
            }
          }

          // If pool exhausted, pick from baseRecs matching member's top artists or language
          if (!chosenSong && baseRecsCursor < baseRecs.length) {
            while (baseRecsCursor < baseRecs.length) {
              const candidate = baseRecs[baseRecsCursor++];
              const normTitle = this.normalizeTitle(candidate.name);
              if (!seenIds.has(candidate.id) && !seenNames.has(normTitle)) {
                chosenSong = candidate;
                seenIds.add(candidate.id);
                seenNames.add(normTitle);
                break;
              }
            }
          }

          if (chosenSong) {
            blendedQueue.push({
              song: chosenSong,
              isManual: false,
              forUserName: pool.member.name,
              isBlend: false,
            });
          }
        } else {
          // Shared Blend Slot (Common ground between members)
          let blendSong: Song | null = null;

          // Check if any baseRecs match shared artist or language
          for (let i = baseRecsCursor; i < baseRecs.length; i++) {
            const candidate = baseRecs[i];
            const normTitle = this.normalizeTitle(candidate.name);
            if (seenIds.has(candidate.id) || seenNames.has(normTitle)) continue;

            const candArtist = candidate.artist?.toLowerCase() || '';
            const matchesShared = Array.from(sharedArtists).some((a) => candArtist.includes(a));

            if (matchesShared || !blendSong) {
              blendSong = candidate;
              baseRecsCursor = i + 1;
              seenIds.add(candidate.id);
              seenNames.add(normTitle);
              break;
            }
          }

          if (blendSong) {
            blendedQueue.push({
              song: blendSong,
              isManual: false,
              isBlend: true,
            });
          }
        }

        turnIndex++;

        // Safety break if all sources exhausted
        const allPoolsExhausted = memberPools.every((p) => p.cursor >= p.songs.length);
        if (allPoolsExhausted && baseRecsCursor >= baseRecs.length) {
          break;
        }
      }

      if (blendCache.size > 30) {
        const oldestKey = blendCache.keys().next().value;
        if (oldestKey) blendCache.delete(oldestKey);
      }
      blendCache.set(cacheKey, { timestamp: Date.now(), items: blendedQueue });
      return blendedQueue;
    } catch (err) {
      console.error('[ColabBlendGenerator] Failed to generate blend:', err);
      return [];
    }
  }

  private static normalizeTitle(title: string): string {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
}
