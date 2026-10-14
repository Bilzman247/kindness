import { NextResponse } from 'next/server';
import { serverBotManager } from '../../../../src/core/server/bot-runner';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const status = serverBotManager.stop(body?.reason || 'user_action');
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to stop background bot' },
      { status: 500 }
    );
  }
}
