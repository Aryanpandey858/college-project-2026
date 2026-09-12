// api/incidents/route.ts: POST endpoint receiving incident metadata + Base64 snapshot, uploading to Supabase Storage, inserting to DB, and dispatching Resend alert email.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase/server';
import { generateLiveToken } from '../../../lib/token';
import { sendIncidentAlertEmail } from '../../../lib/email/resend';
import type { IncidentPayload, IncidentApiResponse } from '../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as IncidentPayload;

    const {
      type,
      title,
      description,
      confidence,
      snapshotBase64,
      snapshotMimeType = 'image/jpeg',
      recipientEmail,
      metadata = {},
    } = body;

    if (!type || !title || !description || !recipientEmail || !snapshotBase64) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields: type, title, description, recipientEmail, snapshotBase64',
        },
        { status: 400 }
      );
    }

    const normalizedSnapshot = snapshotBase64.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
      ''
    );

    const buffer = Buffer.from(normalizedSnapshot, 'base64');

    const fileName = `incident-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.jpg`;

    const supabase = getSupabaseServerClient();

    const { error: uploadError } = await supabase.storage
      .from('incident-snapshots')
      .upload(fileName, buffer, {
        contentType: snapshotMimeType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          success: false,
          error: `Snapshot upload failed: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('incident-snapshots')
      .getPublicUrl(fileName);

    const liveToken = generateLiveToken(fileName);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const liveViewerUrl = `${appUrl}/live/${liveToken}`;

    const { data: insertedIncident, error: insertError } = await supabase
      .from('incidents')
      .insert([
        {
          type,
          title,
          description,
          confidence,
          snapshot_url: publicUrlData.publicUrl,
          recipient_email: recipientEmail,
          live_token: liveToken,
          metadata,
        },
      ])
      .select()
      .single();

    if (insertError || !insertedIncident) {
      return NextResponse.json(
        {
          success: false,
          error: `Database insert failed: ${insertError?.message ?? 'unknown error'}`,
        },
        { status: 500 }
      );
    }

    try {
      await sendIncidentAlertEmail({
        recipientEmail,
        type,
        title,
        description,
        confidence,
        snapshotUrl: publicUrlData.publicUrl,
        liveViewerUrl,
        createdAt: insertedIncident.created_at,
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);

      return NextResponse.json(
        {
          success: false,
          error:
            emailError instanceof Error
              ? emailError.message
              : 'Email dispatch failed',
        },
        { status: 500 }
      );
    }

    const response: IncidentApiResponse = {
      success: true,
      incidentId: insertedIncident.id,
      snapshotUrl: publicUrlData.publicUrl,
      liveViewerUrl,
      remainingSeconds: 30 * 60,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected incident processing failure',
      },
      { status: 500 }
    );
  }
}
