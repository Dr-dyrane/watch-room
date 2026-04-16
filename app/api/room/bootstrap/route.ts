import { NextResponse } from 'next/server';

import { joinRoom } from '@/lib/room-service';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      secret: string;
      sessionId: string;
      name: string;
    };

    const snapshot = await joinRoom(body);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to join room.',
      },
      { status: 400 },
    );
  }
}
