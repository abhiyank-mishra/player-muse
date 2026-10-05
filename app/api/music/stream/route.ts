import { NextRequest, NextResponse } from 'next/server';

interface CachedFormat {
  url: string;
  mimeType: string;
  bitrate: number;
  contentLength?: number;
  expiresAt: number;
}

// In-memory cache for resolved stream URLs (2-hour TTL)
const audioStreamCache = new Map<string, CachedFormat>();

async function resolveYouTubeAudioStream(videoId: string, bypassCache = false): Promise<{ stream?: CachedFormat; debug?: any }> {
  if (!bypassCache) {
    const cached = audioStreamCache.get(videoId);
    if (cached && Date.now() < cached.expiresAt) {
      return { stream: cached };
    }
  }

  try {
    const playerBody = {
      videoId: videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38',
          hl: 'en',
          gl: 'IN'
        }
      },
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS'
        }
      },
      contentCheckOk: true,
      racyCheckOk: true
    };

    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip'
      },
      body: JSON.stringify(playerBody)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Stream] YouTube player API returned status ${res.status}:`, errText);
      return { debug: { status: res.status, errorText: errText.slice(0, 300) } };
    }

    const data = await res.json();

    // 1. PRIORITY: Progressive formats (itag: 18 - 360p MP4 audio/video container)
    // Progressive formats can be streamed continuously, support all HTTP Range requests (bytes=0-, seeking, etc.),
    // and DO NOT enforce chunk size limits that cause 403 Forbidden on adaptive DASH formats.
    const progressiveFormats = (data.streamingData?.formats || [])
      .filter((f: any) => f.url && (f.itag === 18 || (f.mimeType && f.mimeType.includes('video/mp4'))));

    let best = progressiveFormats[0];

    // 2. Fallback: Adaptive audio-only formats
    if (!best || !best.url) {
      const adaptiveFormats = (data.streamingData?.adaptiveFormats || [])
        .filter((f: any) => f.url && f.mimeType && f.mimeType.includes('audio'))
        .sort((a: any, b: any) => {
          const aMp4 = a.mimeType.includes('audio/mp4') ? 1 : 0;
          const bMp4 = b.mimeType.includes('audio/mp4') ? 1 : 0;
          if (aMp4 !== bMp4) return bMp4 - aMp4;
          return (b.bitrate || 0) - (a.bitrate || 0);
        });
      best = adaptiveFormats[0];
    }

    if (!best || !best.url) {
      console.error(`[Stream] No playable stream format found for ${videoId}`, data.playabilityStatus);
      return { debug: { playability: data.playabilityStatus, formatsCount: data.streamingData?.formats?.length, adaptiveCount: data.streamingData?.adaptiveFormats?.length, hasStreamingData: !!data.streamingData } };
    }

    const entry: CachedFormat = {
      url: best.url,
      mimeType: best.mimeType.split(';')[0] || 'audio/mp4',
      bitrate: best.bitrate || 128000,
      contentLength: best.contentLength ? parseInt(best.contentLength, 10) : undefined,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };

    audioStreamCache.set(videoId, entry);
    return { stream: entry };
  } catch (err: any) {
    console.error(`[Stream] Failed to resolve stream for ${videoId}:`, err);
    return { debug: { exception: err?.message || String(err) } };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let id = searchParams.get('id') || '';

  // Clean video ID
  if (id.startsWith('yt_')) {
    id = id.replace(/^yt_/, '');
  }

  if (!id) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  const result = await resolveYouTubeAudioStream(id);
  let streamInfo = result.stream;
  if (!streamInfo) {
    return NextResponse.json({ error: 'Audio stream unavailable', debug: result.debug }, { status: 404 });
  }

  const range = req.headers.get('range');
  const upstreamHeaders: HeadersInit = {
    'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip'
  };
  if (range) {
    upstreamHeaders['Range'] = range;
  }

  try {
    let upstreamRes = await fetch(streamInfo.url, {
      headers: upstreamHeaders
    });

    // If stream URL was stale or expired (403), re-resolve once fresh
    if (upstreamRes.status === 403) {
      console.warn(`[Stream] Received 403 for ${id}, refreshing stream URL...`);
      audioStreamCache.delete(id);
      const refreshed = await resolveYouTubeAudioStream(id, true);
      if (refreshed?.stream) {
        streamInfo = refreshed.stream;
        upstreamRes = await fetch(streamInfo.url, {
          headers: upstreamHeaders
        });
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.error(`[Stream] Upstream returned status ${upstreamRes.status} for ${id}`);
      return NextResponse.json({ error: 'Upstream stream error' }, { status: upstreamRes.status });
    }

    const responseHeaders = new Headers();
    const contentType = streamInfo.mimeType.includes('mp4') ? 'audio/mp4' : streamInfo.mimeType;
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    if (upstreamRes.headers.get('content-range')) {
      responseHeaders.set('Content-Range', upstreamRes.headers.get('content-range')!);
    }
    if (upstreamRes.headers.get('content-length')) {
      responseHeaders.set('Content-Length', upstreamRes.headers.get('content-length')!);
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders
    });
  } catch (streamErr) {
    console.error(`[Stream] Error streaming chunk for ${id}:`, streamErr);
    return NextResponse.json({ error: 'Streaming error' }, { status: 502 });
  }
}

export async function HEAD(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let id = searchParams.get('id') || '';
  if (id.startsWith('yt_')) id = id.replace(/^yt_/, '');

  if (!id) return new Response(null, { status: 400 });
  const result = await resolveYouTubeAudioStream(id);
  const streamInfo = result?.stream;
  if (!streamInfo) return new Response(null, { status: 404 });

  const headers = new Headers();
  const contentType = streamInfo.mimeType.includes('mp4') ? 'audio/mp4' : streamInfo.mimeType;
  headers.set('Content-Type', contentType);
  headers.set('Accept-Ranges', 'bytes');
  if (streamInfo.contentLength) {
    headers.set('Content-Length', streamInfo.contentLength.toString());
  }
  return new Response(null, { status: 200, headers });
}
