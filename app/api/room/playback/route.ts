import { NextResponse } from 'next/server';

import { sendPlayback } from '@/lib/room-service';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      secret: string;
      sessionId: string;
      sender: string;
      action: 'PLAY' | 'PAUSE' | 'SEEK_FORWARD' | 'SEEK_BACKWARD' | 'SYNC_NOW';
      currentTime: number;
      isPlaying: boolean;
      title?: string | null;
    };

    await sendPlayback(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to sync playback.',
      },
      { status: 400 },
    );
  }
}
