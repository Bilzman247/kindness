import { NextResponse } from 'next/server';

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.VITE_DERIV_APP_ID || '33E1sj7WNaMsjg5MAxPyS';
const DERIV_ENV = process.env.NEXT_PUBLIC_DERIV_ENV || 'production';
const DERIV_API_URL = DERIV_ENV === 'staging' ? 'https://staging-api.deriv.com' : 'https://api.deriv.com';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const body = await req.json();
    const { account_id, app_id } = body;

    if (!authHeader || !account_id) {
      return NextResponse.json({ error: 'Missing account_id or Authorization header' }, { status: 400 });
    }

    const response = await fetch(`${DERIV_API_URL}/trading/v1/options/accounts/${account_id}/otp`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Deriv-App-ID': String(app_id || DERIV_APP_ID),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error fetching Deriv OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch Deriv OTP' },
      { status: 500 }
    );
  }
}
