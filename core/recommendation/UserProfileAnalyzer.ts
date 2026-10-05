import { Song } from '@/lib/types';
import { UserProfile } from './recommendation.types';

export class UserProfileAnalyzer {
  static analyze(playHistory: Song[], likedArtists: string[] = []): UserProfile {
    if (!playHistory || playHistory.length === 0) {
      return {
        topArtists: likedArtists.slice(0, 5),
        dominantMood: null,
        dominantLanguage: null,
        avgDuration: 0
      };
    }

    // Limit to exactly the last 20 played songs
    const recentHistory = playHistory.slice(0, 20);

    const artistCounts: Record<string, number> = {};
    let totalDuration = 0;
    
    // Mood detection
    const moodCounts: Record<string, number> = {};
    // Language tracking
    const langCounts: Record<string, number> = {};

    recentHistory.forEach(song => {
      // 1. Artist tracking — handle comma-separated artists
      if (song.artist && song.artist !== 'Unknown Artist') {
        const primaryArtist = song.artist.split(',')[0].trim();
        artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
      }
      
      // 2. Average duration
      totalDuration += song.duration || 0;

      // 3. Mood heuristic — extended for Bollywood/Desi keywords + Artist heuristics
      const text = `${song.name} ${song.album} ${song.artist}`.toLowerCase();
      const artist = song.artist?.toLowerCase() || '';

      if (
        text.match(/sad|dard|broken|bewafa|tanhai|lonely|cry|gham|rula|tanha|judai|alvida|bichhad|aansoo|chhod|khamoshi|tadap|maahi|duniya|kho gaye|bhula|yaad/) ||
        artist.match(/b praak|jagjit|kk|mustafa zahid|bilal saeed|ankit tiwari/)
      ) {
          moodCounts['sad'] = (moodCounts['sad'] || 0) + 1;
      }
      if (
        text.match(/party|dance|remix|bass|dj|club|beat|nachle|thumka|sharab|peg|daaru|bhangra|dhol|pataka|swag|badshah|hookah|boom|dhamaka/) ||
        artist.match(/badshah|honey singh|diljit|karan aujla|guru randhawa|neha kakkar|nucleya|ap dhillon|hardy sandhu/)
      ) {
          moodCounts['energetic'] = (moodCounts['energetic'] || 0) + 1;
      }
      if (
        text.match(/chill|acoustic|relax|lofi|sleep|soft|soothing|unplugged|slowed|reverb|chai|hawa|barish|subah|shaam|raat|sukoon|khoya|sitara/) ||
        artist.match(/prateek kuhad|anuv jain|ritviz|when chai met toast|zaeden|lucky ali|osho jain|twin strings/)
      ) {
          moodCounts['chill'] = (moodCounts['chill'] || 0) + 1;
      }
      if (
        text.match(/romantic|love|pyaar|ishq|dil|valentine|dilbar|sanam|jaan|tere|humsafar|deewana|saath|mohabbat|tum|rabba|dua|wafa|shiddat|kaise|tu hi|mann|saiyaan|naina/) ||
        artist.match(/arijit|atif aslam|shreya|jubin|mohit chauhan|armaan malik|darshan raval|sanam|jasleen/)
      ) {
          moodCounts['romantic'] = (moodCounts['romantic'] || 0) + 1;
      }
      if (
        text.match(/gym|workout|fitness|beast|power|motivation|pump|gang|hustle|flow|fire|warrior|jatt|legend/) ||
        artist.match(/sidhu|karan aujla|divine|seedhe maut|emiway|kr\$na|raftaar/)
      ) {
          moodCounts['gym'] = (moodCounts['gym'] || 0) + 1;
      }

      // 4. Language tracking
      const lang = song.language?.toLowerCase();
      if (lang && lang !== 'unknown') {
          langCounts[lang] = (langCounts[lang] || 0) + 1;
      }
    });

    // Fold in explicit liked artists
    likedArtists.forEach(artist => {
      if (artist && artist !== 'Unknown Artist') {
        artistCounts[artist] = (artistCounts[artist] || 0) + 3;
      }
    });

    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(entry => entry[0]);

    // Dominant mood
    let dominantMood: string | null = null;
    let maxMoodCount = 0;
    Object.entries(moodCounts).forEach(([mood, count]) => {
        if (count > maxMoodCount) {
            maxMoodCount = count;
            dominantMood = mood;
        }
    });

    // Dominant language
    let dominantLanguage: string | null = null;
    let maxLangCount = 0;
    Object.entries(langCounts).forEach(([lang, count]) => {
        if (count > maxLangCount) {
            maxLangCount = count;
            dominantLanguage = lang;
        }
    });

    const avgDuration = recentHistory.length > 0 ? Math.round(totalDuration / recentHistory.length) : 0;

    return {
      topArtists,
      dominantMood,
      dominantLanguage,
      avgDuration
    };
  }

  static matchesMood(song: Song, targetMood: string | null): boolean {
    if (!song || !targetMood) return false;
    const mood = targetMood.toLowerCase().trim();
    const text = `${song.name || ''} ${song.album || ''} ${song.artist || ''}`.toLowerCase();
    const artist = (song.artist || '').toLowerCase();

    switch (mood) {
      case 'sad':
        return Boolean(
          text.match(/\b(sad|dard|broken|bewafa|tanhai|lonely|cry|gham|rula|tanha|judai|alvida|bichhad|aansoo|chhod|khamoshi|tadap|maahi|duniya|kho gaye|bhula|yaad)\b/i) ||
          artist.match(/b praak|jagjit|kk|mustafa zahid|bilal saeed|ankit tiwari/)
        );
      case 'energetic':
        return Boolean(
          text.match(/\b(party|dance|remix|bass|dj|club|beat|nachle|thumka|sharab|peg|daaru|bhangra|dhol|pataka|swag|badshah|hookah|boom|dhamaka)\b/i) ||
          artist.match(/badshah|honey singh|diljit|karan aujla|guru randhawa|neha kakkar|nucleya|ap dhillon|hardy sandhu/)
        );
      case 'chill':
        return Boolean(
          text.match(/\b(chill|acoustic|relax|lofi|sleep|soft|soothing|unplugged|slowed|reverb|chai|hawa|barish|subah|shaam|raat|sukoon|khoya|sitara)\b/i) ||
          artist.match(/prateek kuhad|anuv jain|ritviz|when chai met toast|zaeden|lucky ali|osho jain|twin strings|talwiinder/)
        );
      case 'romantic':
        return Boolean(
          text.match(/\b(romantic|love|pyaar|ishq|dil|valentine|dilbar|sanam|jaan|tere|humsafar|deewana|saath|mohabbat|tum|rabba|dua|wafa|shiddat|kaise|tu hi|mann|saiyaan|naina)\b/i) ||
          artist.match(/arijit|atif aslam|shreya|jubin|mohit chauhan|armaan malik|darshan raval|sanam|jasleen/)
        );
      case 'gym':
        return Boolean(
          text.match(/\b(gym|workout|fitness|beast|power|motivation|pump|gang|hustle|flow|fire|warrior|jatt|legend)\b/i) ||
          artist.match(/sidhu|karan aujla|divine|seedhe maut|emiway|kr\$na|raftaar/)
        );
      default:
        return false;
    }
  }
}
