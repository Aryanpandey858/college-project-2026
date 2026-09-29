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
          background: '#f3f5f9',
          color: '#1f2937',
          fontFamily: 'Inter, Arial, sans-serif',
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
          background: '#f3f5f9',
          color: '#1f2937',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #dfe7ef',
            borderRadius: 18,
            padding: 32,
            maxWidth: 520,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, color: '#b91c1c' }}>
            Session expired
          </h1>
          <p style={{ marginTop: 16, fontSize: 16, color: '#475569' }}>
            This live access link is no longer valid or has expired.
          </p>
          <p style={{ color: '#64748b', marginTop: 12 }}>
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
        background: '#f3f5f9',
        color: '#1f2937',
        fontFamily: 'Inter, Arial, sans-serif',
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #dfe7ef',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.12em',
                color: '#64748b',
                textTransform: 'uppercase',
              }}
            >
              Live incident viewer
            </div>
            <div style={{ fontSize: 20, marginTop: 6, fontWeight: 700 }}>
              Incident #{verification.incidentId.slice(0, 8)}
            </div>
          </div>

          <div
            style={{
              background: '#eef2ff',
              color: '#3749c9',
              border: '1px solid #c7d2fe',
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
              'linear-gradient(180deg, #f8fafc 0%, #eef3f8 100%)',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 500,
              borderRadius: 20,
              background:
                'linear-gradient(135deg, #ffffff, #f1f5f9)',
              border: '1px solid #dfe7ef',
              display: 'grid',
              placeItems: 'center',
              color: '#475569',
              fontSize: 22,
              textAlign: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
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