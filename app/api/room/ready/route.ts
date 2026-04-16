import { NextResponse } from 'next/server';

import { setReadyState } from '@/lib/room-service';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      secret: string;
      sessionId: string;
      ready: boolean;
    };

    await setReadyState(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to update ready state.',
      },
      { status: 400 },
    );
  }
}
