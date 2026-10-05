import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface LyricLine {
    time: number;
    text: string;
    originalText?: string;
}

// In-memory cache for lyrics to avoid redundant external network calls
const lyricsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanString(str: string): string {
    return str
        .replace(/\s*[\(\[](?:from|feat|ft\.|with|official|video|lyric|audio|remix|slowed|reverb|version|full|original).*?[\)\]]/gi, '')
        .replace(/\s*-\s*(?:from|feat|ft|official|video|lyric|audio|remix).*$/gi, '')
        .replace(/[\(\[].*?[\)\]]/g, '')
        .trim();
}

function isHinglishOrLatin(text: string): boolean {
    if (!text) return false;
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
    const indicCount = (text.match(/[\u0900-\u097F\u0A00-\u0A7F]/g) || []).length;
    return latinCount > indicCount;
}

// Convert Devanagari text into natural Hinglish (Roman script)
export function devanagariToHinglish(text: string): string {
    if (!text) return '';
    const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (latinCount > devanagariCount) return text;

    let s = text.normalize('NFC');

    // Replace common nukta characters
    s = s.replace(/क़/g, 'q')
         .replace(/ख़/g, 'kh')
         .replace(/ग़/g, 'g')
         .replace(/ज़/g, 'z')
         .replace(/ड़/g, 'r')
         .replace(/ढ़/g, 'rh')
         .replace(/फ़/g, 'f');

    const charMap: Record<string, string> = {
        'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
        'ा':'a','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au',
        'ं':'n','ँ':'n','ः':'h',
        'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng',
        'च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
        'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n',
        'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
        'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m',
        'य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
        'क्ष':'ksh','त्र':'tr','ज्ञ':'gy'
    };

    const consonants = new Set([
        'क','ख','ग','घ','ङ','च','छ','ज','झ','ञ','ट','ठ','ड','ढ','ण','त','थ','द','ध','न',
        'प','फ','ब','भ','म','य','र','ल','व','श','ष','स','ह'
    ]);

    const matras = new Set(['ा','ि','ी','ु','ू','ृ','े','ै','ो','ौ']);

    let out = '';
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        const next = s[i + 1];

        if (consonants.has(c)) {
            const rom = charMap[c] || c;
            if (next === '्') {
                out += rom;
                i++; // skip halant
            } else if (matras.has(next)) {
                let m = charMap[next];
                if (next === 'ा') {
                    const nextNext = s[i + 2];
                    const isWordEnd = !nextNext || /[\s,.\-!?"']/.test(nextNext);
                    m = isWordEnd ? 'a' : 'aa';
                }
                out += rom + m;
                i++; // skip matra
            } else if (next === 'ं' || next === 'ँ') {
                out += rom + 'an';
                i++;
            } else {
                const isEnd = !next || /[\s,.\-!?"']/.test(next);
                out += isEnd ? rom : rom + 'a';
            }
        } else if (charMap[c]) {
            out += charMap[c];
        } else if (c === '्') {
            // Stray halant
        } else {
            out += c;
        }
    }

    // Polish common words & prepositions for natural Hinglish feel
    out = out.replace(/\bmera\b/gi, 'Mera')
             .replace(/\btera\b/gi, 'Tera')
             .replace(/\bhai\b/gi, 'hai')
             .replace(/\bko\b/gi, 'ko')
             .replace(/\bse\b/gi, 'se')
             .replace(/\bme\b/gi, 'mein')
             .replace(/\bmen\b/gi, 'mein')
             .replace(/\bka\b/gi, 'ka')
             .replace(/\bki\b/gi, 'ki')
             .replace(/\bke\b/gi, 'ke');

    return out.replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
}

function parseLrc(lrcText: string): LyricLine[] {
    const lines = lrcText.split('\n');
    const result: LyricLine[] = [];
    const lrcRegex = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/;

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;

        const match = trimmed.match(lrcRegex);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const fractionStr = match[3] || '0';
            const fraction = parseFloat(`0.${fractionStr}`);
            const time = Number((minutes * 60 + seconds + fraction).toFixed(2));
            const rawText = match[4].trim();

            if (rawText) {
                // Check if text is Devanagari, convert to Hinglish
                const hinglishText = isHinglishOrLatin(rawText) ? rawText : devanagariToHinglish(rawText);
                result.push({ 
                    time, 
                    text: hinglishText, 
                    originalText: rawText 
                });
            }
        }
    }

    return result.sort((a, b) => a.time - b.time);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title') || '';
    const rawArtist = searchParams.get('artist') || '';
    const rawDuration = searchParams.get('duration') || '';

    if (!rawTitle) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const cleanTitle = cleanString(rawTitle);
    const primaryArtist = cleanString(rawArtist.split(/[,&/|]/)[0] || '');
    const durationSec = rawDuration ? parseInt(rawDuration, 10) : 0;

    const cacheKey = `${cleanTitle.toLowerCase()}___${primaryArtist.toLowerCase()}`;
    const cached = lyricsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
    }

    const headers = {
        'User-Agent': 'MuseMusic/1.0 (https://muse.abhiyank.in)',
        'Accept': 'application/json'
    };

    try {
        let bestMatch: any = null;

        // Attempt 1: Exact match via /api/get
        let getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
        if (durationSec > 0) {
            getUrl += `&duration=${durationSec}`;
        }

        try {
            const getRes = await fetch(getUrl, { headers, next: { revalidate: 3600 } });
            if (getRes.ok) {
                const data = await getRes.json();
                if (data && (data.syncedLyrics || data.plainLyrics)) {
                    bestMatch = data;
                }
            }
        } catch {
            // Ignore and proceed to search
        }

        // Attempt 2: Search via /api/search with title and artist, prioritizing Hinglish/Latin
        if (!bestMatch || (bestMatch && !isHinglishOrLatin(bestMatch.syncedLyrics || ''))) {
            try {
                const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${primaryArtist}`)}`;
                const searchRes = await fetch(searchUrl, { headers, next: { revalidate: 3600 } });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (Array.isArray(searchData) && searchData.length > 0) {
                        // 1st priority: syncedLyrics in Hinglish/Latin
                        const latinSynced = searchData.find((item: any) => item.syncedLyrics && isHinglishOrLatin(item.syncedLyrics));
                        // 2nd priority: any syncedLyrics
                        const anySynced = searchData.find((item: any) => item.syncedLyrics);
                        
                        if (latinSynced) {
                            bestMatch = latinSynced;
                        } else if (!bestMatch && anySynced) {
                            bestMatch = anySynced;
                        } else if (!bestMatch) {
                            bestMatch = searchData[0];
                        }
                    }
                }
            } catch {
                // Ignore and proceed
            }
        }

        // Attempt 3: Search with just clean title if still nothing
        if (!bestMatch && cleanTitle) {
            try {
                const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`;
                const searchRes = await fetch(searchUrl, { headers, next: { revalidate: 3600 } });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (Array.isArray(searchData) && searchData.length > 0) {
                        const latinSynced = searchData.find((item: any) => item.syncedLyrics && isHinglishOrLatin(item.syncedLyrics));
                        const anySynced = searchData.find((item: any) => item.syncedLyrics);
                        bestMatch = latinSynced || anySynced || searchData[0];
                    }
                }
            } catch {
                // Ignore
            }
        }

        if (bestMatch && bestMatch.syncedLyrics) {
            const lines = parseLrc(bestMatch.syncedLyrics);
            const responseData = {
                synced: true,
                lines,
                plain: bestMatch.plainLyrics || null,
                trackName: bestMatch.trackName || cleanTitle,
                artistName: bestMatch.artistName || primaryArtist,
                isHinglish: true
            };
            lyricsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
            return NextResponse.json(responseData);
        }

        if (bestMatch && bestMatch.plainLyrics) {
            const rawPlain = bestMatch.plainLyrics;
            const hinglishPlain = isHinglishOrLatin(rawPlain) ? rawPlain : devanagariToHinglish(rawPlain);
            const responseData = {
                synced: false,
                lines: [],
                plain: hinglishPlain,
                originalPlain: rawPlain,
                trackName: bestMatch.trackName || cleanTitle,
                artistName: bestMatch.artistName || primaryArtist,
                isHinglish: true
            };
            lyricsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
            return NextResponse.json(responseData);
        }

        const notFoundData = {
            synced: false,
            lines: [],
            plain: null,
            message: 'No lyrics found'
        };
        lyricsCache.set(cacheKey, { data: notFoundData, timestamp: Date.now() });
        return NextResponse.json(notFoundData);

    } catch (err: any) {
        console.error('[Lyrics API] Fetch error:', err);
        return NextResponse.json({
            synced: false,
            lines: [],
            error: 'Failed to fetch lyrics'
        }, { status: 500 });
    }
}
