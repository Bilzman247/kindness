import { NextResponse } from 'next/server';

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.VITE_DERIV_APP_ID || '33E1sj7WNaMsjg5MAxPyS';
const DERIV_ENV = process.env.NEXT_PUBLIC_DERIV_ENV || 'production';
const DERIV_API_URL = DERIV_ENV === 'staging' ? 'https://staging-api.deriv.com' : 'https://api.deriv.com';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const appId = req.headers.get('x-deriv-app-id') || DERIV_APP_ID;

    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const response = await fetch(`${DERIV_API_URL}/trading/v1/options/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Deriv-App-ID': String(appId),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error fetching Deriv accounts:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch Deriv accounts' },
      { status: 500 }
    );
  }
}
