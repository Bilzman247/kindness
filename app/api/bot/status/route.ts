import { NextResponse } from 'next/server';
import { serverBotManager } from '../../../../src/core/server/bot-runner';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = serverBotManager.getStatus();
  return NextResponse.json(status);
}
