/**
 * Spotify API Utility
 * Handles token generation and fetching playlist tracks.
 */

export interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  image: string;
}

const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '').trim();
const decodeEntities = (text: string) => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOT_AUTH_MISSING");
  }

  try {
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
        const errData = await response.json();
        console.error("Spotify Token Error:", errData);
        return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to get Spotify token:", error);
    return null;
  }
}

/**
 * Fallback: Scrapes tracks from the Spotify public embed page.
 * Does not require API keys.
 */
async function getSpotifyPlaylistTracksScraper(playlistId: string): Promise<SpotifyTrack[]> {
  try {
    // Try multiple URLs: embed and main playlist page
    const urls = [
      `https://open.spotify.com/embed/playlist/${playlistId}`,
      `https://open.spotify.com/playlist/${playlistId}`
    ];

    for (const url of urls) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) continue;
      const html = await response.text();

      // Attempt 1: <script id="resource"> (Common in embeds)
      const resourceMatch = html.match(/<script id=\"resource\" type=\"application\/json\">(.*?)<\/script>/);
      if (resourceMatch) {
        try {
          const data = JSON.parse(resourceMatch[1]);
          const items = data.tracks?.items || [];
          if (items.length > 0) {
            return items.map((item: any) => {
              const images = item.track.album.images || [];
              const largestImage = images.length > 0 
                ? images.reduce((largest: any, current: any) => 
                    (current.width || 0) > (largest.width || 0) ? current : largest
                  ).url
                : '';
              
              return {
                name: item.track.name,
                artist: item.track.artists.map((a: any) => a.name).join(', '),
                album: item.track.album.name,
                image: largestImage,
              };
            });
          }
        } catch (e) {}
      }

      // Attempt 2: <script id="initial-state"> (Common in main pages)
      const stateMatch = html.match(/<script id=\"initial-state\" type=\"application\/json\">(.*?)<\/script>/) ||
                         html.match(/<script type=\"application\/json\" id=\"initial-state\">(.*?)<\/script>/);
      if (stateMatch) {
         try {
            const data = JSON.parse(decodeURIComponent(stateMatch[1]));
            // Structure varies, but often tracks are nested deep
            // We can try to find them by searching for "track" objects
            const jsonStr = JSON.stringify(data);
            if (jsonStr.includes('trackName')) {
               // Aggressive regex on the JSON string if structure is too complex
               const trackPattern = /\"trackName\":\"(.*?)\".*?\"artistName\":\"(.*?)\"/g;
               let match;
               const tracks: SpotifyTrack[] = [];
               while ((match = trackPattern.exec(jsonStr)) !== null) {
                  tracks.push({ name: match[1], artist: match[2], album: '', image: '' });
               }
               if (tracks.length > 0) return tracks;
            }
         } catch (e) {}
      }

      // Attempt 3: Specific tag parsing (More reliable)
      const tracks: SpotifyTrack[] = [];
      // Spotify embed uses <h3> for track names and <h4> for artists
      const comboPattern = /<h3[^>]*>(.*?)<\/h3>[\s\S]*?<h4[^>]*>(.*?)<\/h4>/g;
      let match;
      while ((match = comboPattern.exec(html)) !== null) {
          const name = decodeEntities(stripHtml(match[1]));
          const artist = decodeEntities(stripHtml(match[2]));
          if (name && artist && !['Home', 'Search', 'Your Library'].includes(name)) {
              tracks.push({ name, artist, album: '', image: '' });
          }
          if (tracks.length >= 100) break;
      }
      
      if (tracks.length > 0) return tracks;

      // Attempt 4: Last resort, generic text extraction
      const spanPattern = /<span[^>]*>(.*?)<\/span>/g;
      const textNodes: string[] = [];
      let spanMatch;
      while ((spanMatch = spanPattern.exec(html)) !== null) {
          const text = decodeEntities(stripHtml(spanMatch[1]));
          if (text && text.length > 1 && !text.match(/^\d+$/) && !text.match(/^\d{2}:\d{2}$/)) {
              textNodes.push(text);
          }
      }
      
      // Try to pair adjacent nodes that look like Title -> Artist
      for (let i = 0; i < textNodes.length - 1; i++) {
          const name = textNodes[i];
          const artist = textNodes[i+1];
          if (name.length > 2 && artist.length > 2) {
              // Very rough guess
              tracks.push({ name, artist, album: '', image: '' });
              i++; // Skip the one we used as artist
          }
      }
      if (tracks.length > 5) return tracks;
    }

    return [];
  } catch (error) {
    console.error("Scraper failed completely:", error);
    return [];
  }
}

export async function getSpotifyPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  try {
    const token = await getSpotifyToken();
    if (!token) throw new Error("NO_TOKEN");

    let allTracks: SpotifyTrack[] = [];
    let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    while (nextUrl && allTracks.length < 300) {
      const resp: Response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!resp.ok) throw new Error("API_FAIL");

      const jsonData: any = await resp.json();
      
      const newTracks = jsonData.items.map((item: any) => {
        const images = item.track?.album?.images || [];
        const largestImage = images.length > 0 
          ? images.reduce((largest: any, current: any) => 
              (current.width || 0) > (largest.width || 0) ? current : largest
            ).url
          : '';
        
        return {
          name: item.track?.name || 'Unknown Track',
          artist: item.track?.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
          album: item.track?.album?.name || '',
          image: largestImage,
        };
      }).filter((t: SpotifyTrack) => t.name !== 'Unknown Track');

      allTracks = [...allTracks, ...newTracks];
      nextUrl = jsonData.next; // Spotify returns the full URL for the next page
    }

    return allTracks.slice(0, 300); // Enforce strict 300 limit
  } catch (error) {
    console.log("Spotify API failed or missing credentials, falling back to scraper...");
    return getSpotifyPlaylistTracksScraper(playlistId);
  }
}
