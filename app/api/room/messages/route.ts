import { NextResponse } from 'next/server';

import { sendMessage } from '@/lib/room-service';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      secret: string;
      sessionId: string;
      sender: string;
      body: string;
    };

    await sendMessage(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to send message.',
      },
      { status: 400 },
    );
  }
}
