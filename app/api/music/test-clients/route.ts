import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '3Cp2QTBZAFQ';

  interface ClientTest {
    name: string;
    client: Record<string, any>;
    ua: string;
    headers?: Record<string, string>;
  }

  const clients: ClientTest[] = [
    {
      name: 'MWEB',
      client: { clientName: 'MWEB', clientVersion: '2.20240401.01.00', hl: 'en', gl: 'IN' },
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
      headers: { 'Origin': 'https://m.youtube.com', 'Referer': 'https://m.youtube.com/' }
    },
    {
      name: 'WEB_EMBEDDED',
      client: { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20240722.01.00', hl: 'en', gl: 'IN' },
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      headers: { 'Origin': 'https://www.youtube.com', 'Referer': `https://www.youtube.com/embed/${id}` }
    },
    {
      name: 'TVHTML5',
      client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en', gl: 'IN' },
      ua: 'Mozilla/5.0 (PlayStation; PlayStation 4/10.01) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/10.01 Safari/605.1.15',
      headers: {}
    },
    {
      name: 'ANDROID_TEST',
      client: { clientName: 'ANDROID', clientVersion: '19.09.37', hl: 'en', gl: 'IN', androidSdkVersion: 34 },
      ua: 'com.google.android.youtube/19.09.37 (Linux; U; Android 14) gzip',
      headers: {}
    },
    {
      name: 'IOS_FULL',
      client: { clientName: 'IOS', clientVersion: '19.45.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', hl: 'en', gl: 'IN', osName: 'iOS', osVersion: '17.5.1.21F90' },
      ua: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
      headers: {}
    }
  ];

  const results: Record<string, any> = {};

  for (const c of clients) {
    try {
      const payload: any = {
        videoId: id,
        context: { client: c.client },
        playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
        contentCheckOk: true,
        racyCheckOk: true
      };

      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': c.ua,
        ...(c.headers || {})
      };

      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        results[c.name] = { httpStatus: res.status };
        continue;
      }

      const data = await res.json();
      results[c.name] = {
        httpStatus: res.status,
        playability: data.playabilityStatus?.status,
        reason: data.playabilityStatus?.reason,
        hasStreamingData: !!data.streamingData,
        formatsCount: data.streamingData?.formats?.length,
        adaptiveCount: data.streamingData?.adaptiveFormats?.length,
        hasProgUrl: data.streamingData?.formats?.some((f: any) => !!f.url),
        hasAdaptiveUrl: data.streamingData?.adaptiveFormats?.some((f: any) => !!f.url)
      };
    } catch (e: any) {
      results[c.name] = { error: e.message };
    }
  }

  // Also test cobalt / public youtube-audio-stream proxies
  try {
    const cob = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${id}`,
        audioFormat: 'mp3',
        downloadMode: 'audio'
      }),
      signal: AbortSignal.timeout(4000)
    });
    results['cobalt_status'] = cob.status;
  } catch (e: any) {
    results['cobalt_error'] = e.message;
  }

  return NextResponse.json(results);
}
