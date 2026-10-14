import { NextResponse } from 'next/server';
import { serverBotManager } from '../../../../src/core/server/bot-runner';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const config = await req.json();
    const status = await serverBotManager.start(config);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to start background bot' },
      { status: 500 }
    );
  }
}
