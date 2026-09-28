import { NextRequest, NextResponse } from 'next/server';

const FAYDA_BACKEND_URL = process.env.FAYDA_BACKEND_URL || 'http://localhost:5000';

/**
 * GET /api/face/video/[videoId]
 * Proxies face verification video from the internal Fayda backend (localhost:5000)
 * to the public dashboard URL. This solves the mixed-content and localhost issues
 * when the dashboard is deployed to production (HTTPS).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const faydaUrl = `${FAYDA_BACKEND_URL}/api/face/video/${videoId}`;
    console.log(`[Video Proxy] Fetching: ${faydaUrl}`);

    const response = await fetch(faydaUrl, {
      headers: {
        'Accept': 'video/webm, video/mp4, */*',
      },
    });

    if (!response.ok) {
      console.error(`[Video Proxy] Fayda backend returned ${response.status}`);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: response.status }
      );
    }

    // Stream the video response back to the client
    const contentType = response.headers.get('content-type') || 'video/webm';
    const contentLength = response.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // cache for 24 hours
    };
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    const body = response.body;
    if (!body) {
      return NextResponse.json({ error: 'Empty response from video server' }, { status: 502 });
    }

    // @ts-ignore — NextResponse supports ReadableStream body
    return new Response(body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error(`[Video Proxy] Error:`, error.message);
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 502 }
    );
  }
}
