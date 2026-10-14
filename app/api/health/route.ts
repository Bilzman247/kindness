import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'G-Squad',
    timestamp: new Date().toISOString(),
  });
}
