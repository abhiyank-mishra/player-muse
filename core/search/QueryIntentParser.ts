import { QueryIntent } from './search.types';

/**
 * Common Indian & Global artist names — used to detect artist queries and "artist + song" patterns.
 * Sorted by length descending so longer composite names match first.
 */
const KNOWN_ARTISTS_RAW = [
  // Multi-word Indian & Bollywood
  'yo yo honey singh', 'rahat fateh ali khan', 'nusrat fateh ali khan', 'anirudh ravichander',
  'shankar ehsaan loy', 'shankar mahadevan', 'kishore kumar', 'mohammed rafi',
  'lata mangeshkar', 'shreya ghoshal', 'jubin nautiyal', 'darshan raval',
  'diljit dosanjh', 'guru randhawa', 'vishal mishra', 'sunidhi chauhan',
  'udit narayan', 'alka yagnik', 'kumar sanu', 'mohit chauhan',
  'a r rahman', 'ar rahman', 'jagjit singh', 'asha bhosle',
  'prateek kuhad', 'sachin jigar', 'amit trivedi', 'salim sulaiman',
  'rekha bhardwaj', 'kailash kher', 'sukhwinder singh', 'sidhu moose wala',
  'sidhu moosewala', 'karan aujla', 'chani nattan', 'arjan dhillon',
  'amrit maan', 'jordan sandhu', 'gurdas maan', 'babbu maan',
  'mankirt aulakh', 'nimrat khaira', 'sunanda sharma', 'parmish verma',
  'jass manak', 'maninder buttar', 'harrdy sandhu', 'tulsi kumar',
  'palak muchhal', 'stebin ben', 'sachet tandon', 'arijit singh',
  'atif aslam', 'sonu nigam', 'neha kakkar', 'armaan malik',
  'ap dhillon', 'jasleen royal', 'shilpa rao', 'monali thakur',
  'neeti mohan', 'kanika kapoor', 'javed ali', 'devi sri prasad',
  'sid sriram', 'yuvan shankar raja', 'harris jayaraj', 'thaman s',
  'santhosh narayanan', 'vijay antony', 'seedhe maut', 'emiway bantai',
  'fotty seven', 'dino james',

  // Single-word / Short names
  'badshah', 'b praak', 'mika singh', 'shaan', 'mukesh',
  'anuv jain', 'zaeden', 'ritviz', 'papon', 'talwiinder',
  'shubh', 'hustinder', 'divine', 'raftaar', 'mc stan',
  'kalamink', 'bella', 'panther', 'kr$na', 'krsna', 'karma',
  'ikka', 'dsp', 'ilaiyaraaja', 'pritam', 'kk', 'king',

  // Global & Pop
  'the weeknd', 'imagine dragons', 'charlie puth', 'shawn mendes',
  'travis scott', 'kendrick lamar', 'taylor swift', 'justin bieber',
  'billie eilish', 'ariana grande', 'selena gomez', 'post malone',
  'ed sheeran', 'bruno mars', 'alan walker', 'maroon 5',
  'chainsmokers', 'coldplay', 'cold play', 'dua lipa',
  'eminem', 'drake', 'adele', 'rihanna',
];

// Sort descending by length to guarantee longest match priority
const KNOWN_ARTISTS = [...new Set(KNOWN_ARTISTS_RAW)].sort((a, b) => b.length - a.length);

/**
 * Common separators users put between artist and song.
 * "Arijit Singh Tum Hi Ho", "Arijit Singh - Tum Hi Ho", "Tum Hi Ho by Arijit Singh"
 */
const ARTIST_SONG_SEPARATORS = [' - ', ' by ', ' – ', ' — ', ' from ', ' ft ', ' feat '];

const TRENDING_KEYWORDS = ['trending', 'top', 'latest', 'new', 'viral', 'hits', 'best', 'popular'];
const MOOD_KEYWORDS = ['sad', 'romantic', 'lofi', 'chill', 'workout', 'party', 'happy', 'sleep', 'rain', 'night', 'drive', 'study'];
const LYRICS_KEYWORDS = ['lyrics', 'karaoke', 'instrumental'];
const ARTIST_INTENT_PREFIXES = ['songs by ', 'best of ', 'hits of ', 'all songs of ', 'songs of '];
const ARTIST_INTENT_SUFFIXES = [' songs', ' hits', ' all songs', ' discography', ' collection'];

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class QueryIntentParser {
  /**
   * Normalize Hinglish spellings (e.g., 'raataan' -> 'raatan', 'channa' -> 'chana')
   * for enhanced tolerance during matching.
   */
  static normalizeHinglish(text: string): string {
    return text
      .toLowerCase()
      .replace(/aa+/g, 'a')
      .replace(/ee+/g, 'i')
      .replace(/oo+/g, 'u')
      .replace(/nn+/g, 'n')
      .replace(/tt+/g, 't')
      .replace(/dd+/g, 'd')
      .replace(/ll+/g, 'l')
      .replace(/ph/g, 'f')
      .replace(/sh+/g, 's')
      .replace(/w/g, 'v')
      .replace(/z/g, 'j');
  }

  /**
   * Parse the user's search query to extract intent, possible artist name,
   * and possible song title. This enables smarter ranking downstream.
   */
  static parse(query: string): QueryIntent {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return { intent: 'default', keywords: [] };
    }

    // ── 1. Detect explicit artist-song separator patterns ──
    for (const sep of ARTIST_SONG_SEPARATORS) {
      const sepLower = sep.toLowerCase();
      const idx = lower.indexOf(sepLower);
      if (idx > 0) {
        const before = lower.slice(0, idx).trim();
        const after = lower.slice(idx + sepLower.length).trim();

        if (before && after) {
          // "by" pattern: "Tum Hi Ho by Arijit Singh" — song is before, artist after
          if (sep.trim().toLowerCase() === 'by') {
            return {
              intent: 'artist_song',
              keywords: words,
              possibleArtist: after,
              possibleSongTitle: before,
              isExactLookup: true,
            };
          }

          // Dash pattern: "Arijit Singh - Tum Hi Ho" — artist is before, song after
          return {
            intent: 'artist_song',
            keywords: words,
            possibleArtist: before,
            possibleSongTitle: after,
            isExactLookup: true,
          };
        }
      }
    }

    // ── 2. Check for explicit Artist intent ("songs by Arijit", "best of Sidhu", "Karan Aujla songs") ──
    for (const prefix of ARTIST_INTENT_PREFIXES) {
      if (lower.startsWith(prefix)) {
        const potentialArtist = lower.slice(prefix.length).trim();
        if (potentialArtist.length > 1) {
          return {
            intent: 'artist_discography',
            keywords: words,
            possibleArtist: potentialArtist,
            isExactLookup: false,
          };
        }
      }
    }

    for (const suffix of ARTIST_INTENT_SUFFIXES) {
      if (lower.endsWith(suffix)) {
        const potentialArtist = lower.slice(0, -suffix.length).trim();
        if (potentialArtist.length > 1) {
          return {
            intent: 'artist_discography',
            keywords: words,
            possibleArtist: potentialArtist,
            isExactLookup: false,
          };
        }
      }
    }

    // ── 3. Detect known artist names embedded in the query using Word Boundaries ──
    let detectedArtist: string | undefined;
    let detectedSong: string | undefined;
    let isPureArtistQuery = false;

    for (const artist of KNOWN_ARTISTS) {
      // Use regex with non-word boundaries to avoid false positives (e.g. 'king' in 'making')
      const artistRegex = new RegExp(`(^|[^a-zA-Z0-9])${escapeRegExp(artist)}($|[^a-zA-Z0-9])`, 'i');
      if (artistRegex.test(lower)) {
        const remaining = lower.replace(artistRegex, ' ').replace(/\s+/g, ' ').trim();
        if (remaining.length > 1) {
          detectedArtist = artist;
          detectedSong = remaining;
          break;
        } else {
          // Pure artist query! User typed only the artist name (e.g. "Arijit Singh")
          detectedArtist = artist;
          isPureArtistQuery = true;
          break;
        }
      }
    }

    if (isPureArtistQuery && detectedArtist) {
      return {
        intent: 'artist_discography',
        keywords: words,
        possibleArtist: detectedArtist,
        possibleSongTitle: undefined,
        isExactLookup: false,
      };
    }

    if (detectedArtist && detectedSong) {
      return {
        intent: 'artist_song',
        keywords: words,
        possibleArtist: detectedArtist,
        possibleSongTitle: detectedSong,
        isExactLookup: true,
      };
    }

    // ── 4. Detect intent from keywords ──
    let intent: QueryIntent['intent'] = 'default';

    if (TRENDING_KEYWORDS.some(k => words.includes(k))) {
      intent = 'trending';
    } else if (MOOD_KEYWORDS.some(k => words.includes(k))) {
      intent = 'mood';
    } else if (LYRICS_KEYWORDS.some(k => words.includes(k))) {
      intent = 'lyrics';
    }

    // If query is 2+ words and doesn't match any special intent, it's likely
    // a specific song lookup (e.g. "Munni Badnaam Hui" or "Tum Hi Ho")
    const isExactLookup = intent === 'default' && words.length >= 2;

    return {
      intent,
      keywords: words,
      possibleSongTitle: isExactLookup ? lower : undefined,
      isExactLookup,
    };
  }
}
