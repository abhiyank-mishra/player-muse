import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        console.log(`[Proxy] Fetching: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });

        if (!response.ok) {
            console.error(`[Proxy] Source returned ${response.status}: ${response.statusText}`);
            return NextResponse.json({ error: `Source error: ${response.status}` }, { status: response.status });
        }

        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');

        // Build response headers — include Content-Length so XHR can track progress
        const headers: Record<string, string> = {
            'Content-Type': contentType || 'audio/mpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'Accept-Ranges': 'bytes',
        };

        if (contentLength) {
            headers['Content-Length'] = contentLength;
        }

        // Stream the response body instead of buffering the entire file
        // This allows XHR onprogress events to fire with real percentages
        if (response.body) {
            return new Response(response.body, { headers });
        }

        // Fallback: buffer if body isn't streamable
        const buffer = await response.arrayBuffer();
        headers['Content-Length'] = String(buffer.byteLength);
        return new Response(buffer, { headers });

    } catch (error: any) {
        console.error('Proxy Error:', error.message);
        return NextResponse.json({ error: 'Proxy failed', message: error.message }, { status: 500 });
    }
}

