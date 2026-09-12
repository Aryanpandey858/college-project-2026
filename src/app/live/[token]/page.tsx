// live/[token]/page.tsx: Emergency responder route that authenticates a 30-minute HMAC token and displays the active surveillance stream.

'use client';

import { useEffect, useMemo, useState } from 'react';

type VerificationState = {
  valid: boolean;
  remainingSeconds: number;
  incidentId: string;
  error?: string;
};

export default function LiveViewerPage({
  params,
}: {
  params: { token: string };
}) {
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    async function loadVerification() {
      try {
        const res = await fetch(`/api/live-token?token=${params.token}`, {
          cache: 'no-store',
        });

        const data = (await res.json()) as VerificationState;

        setVerification(data);
        setSecondsLeft(data.remainingSeconds ?? 0);
      } catch {
        setVerification({
          valid: false,
          remainingSeconds: 0,
          incidentId: '',
          error: 'Failed to verify token',
        });
      }
    }

    loadVerification();
  }, [params.token]);

  useEffect(() => {
    if (!verification?.valid) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [verification?.valid]);

  if (!verification) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#090d17',
          color: '#e5ecff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        Verifying session...
      </main>
    );
  }

  if (!verification.valid) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#090d17',
          color: '#e5ecff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            background: '#121a2d',
            border: '1px solid #2d406f',
            borderRadius: 18,
            padding: 32,
            maxWidth: 520,
            width: '90%',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, color: '#ff7b7b' }}>
            Session Expired
          </h1>
          <p style={{ marginTop: 16, fontSize: 16, color: '#dfe9ff' }}>
            This live access link is no longer valid or has expired.
          </p>
          <p style={{ color: '#9bb0d9', marginTop: 12 }}>
            {verification.error ?? 'Invalid or expired token'}
          </p>
        </div>
      </main>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const remainingSeconds = secondsLeft % 60;

  const countdownLabel = useMemo(
    () =>
      `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`,
    [minutes, remainingSeconds]
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#090d17',
        color: '#e5ecff',
        fontFamily: 'Arial, sans-serif',
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          background: '#111827',
          border: '1px solid #2d406f',
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#101a30',
            borderBottom: '1px solid #243865',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.12em',
                color: '#9bb0d9',
                textTransform: 'uppercase',
              }}
            >
              Live Incident Viewer
            </div>
            <div style={{ fontSize: 20, marginTop: 6, fontWeight: 700 }}>
              Incident #{verification.incidentId.slice(0, 8)}
            </div>
          </div>

          <div
            style={{
              background: '#16253f',
              color: '#8ef0b0',
              border: '1px solid #2d6a4d',
              borderRadius: 999,
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {countdownLabel} remaining
          </div>
        </div>

        <div
          style={{
            minHeight: 540,
            display: 'grid',
            placeItems: 'center',
            background:
              'radial-gradient(circle at center, rgba(59,130,246,0.12), rgba(9,13,23,1) 55%)',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 500,
              borderRadius: 20,
              background:
                'linear-gradient(135deg, rgba(15,23,42,1), rgba(17,24,39,1))',
              border: '1px solid #2d406f',
              display: 'grid',
              placeItems: 'center',
              color: '#8aa6d9',
              fontSize: 22,
              textAlign: 'center',
              boxShadow: '0 0 40px rgba(59,130,246,0.18)',
            }}
          >
            Live stream placeholder
            <br />
            Connect this page to your realtime stream once the broadcaster is active.
          </div>
        </div>
      </div>
    </main>
  );
}
