// api/live-token/route.ts: GET endpoint to validate emergency live stream tokens and return remaining session time within the 30-minute window.
import { NextRequest, NextResponse } from 'next/server';
import { verifyLiveToken } from '../../../lib/token';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      {
        valid: false,
        remainingSeconds: 0,
        incidentId: '',
        error: 'Missing token',
      },
      { status: 400 }
    );
  }

  const verification = verifyLiveToken(token);

  if (!verification.valid) {
    return NextResponse.json(
      {
        valid: false,
        remainingSeconds: 0,
        incidentId: verification.incidentId || '',
        error: 'Invalid or expired token',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    valid: true,
    remainingSeconds: verification.remainingSeconds,
    incidentId: verification.incidentId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body?.token;

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          remainingSeconds: 0,
          incidentId: '',
          error: 'Missing token',
        },
        { status: 400 }
      );
    }

    const verification = verifyLiveToken(token);

    if (!verification.valid) {
      return NextResponse.json(
        {
          valid: false,
          remainingSeconds: 0,
          incidentId: verification.incidentId || '',
          error: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      remainingSeconds: verification.remainingSeconds,
      incidentId: verification.incidentId,
    });
  } catch {
    return NextResponse.json(
      {
        valid: false,
        remainingSeconds: 0,
        incidentId: '',
        error: 'Malformed request',
      },
      { status: 400 }
    );
  }
}
