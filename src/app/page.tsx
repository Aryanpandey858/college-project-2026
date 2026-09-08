'use client';

/**
 * page.tsx — Primary Surveillance Console
 *
 * Assembles:
 *  - AlertHeader (top bar: email, status, audio toggle)
 *  - CameraFeed (full-screen AI feed + HUD canvas)
 *  - ThreatStats (telemetry bar below header)
 *  - IncidentDrawer (right-side realtime alert panel)
 *
 * Coordinates shared state:
 *  - recipientEmail (localStorage persistent)
 *  - audioEnabled
 *  - live AI stats (fps, latency, person/vehicle counts, activeThreat)
 */

import { useCallback, useEffect, useState } from 'react';
import AlertHeader from '@/components/AlertHeader';
import CameraFeed from '@/components/CameraFeed';
import ThreatStats from '@/components/ThreatStats';
import IncidentDrawer from '@/components/IncidentDrawer';
import type { ThreatType } from '@/lib/types';

const EMAIL_STORAGE_KEY = 'sentinel_recipient_email';
const AUDIO_STORAGE_KEY = 'sentinel_audio_enabled';

interface AIStats {
  fps: number;
  inferenceMs: number;
  personCount: number;
  vehicleCount: number;
  activeThreat: ThreatType | null;
  modelsLoaded: boolean;
  cameraActive: boolean;
}

const DEFAULT_STATS: AIStats = {
  fps: 0,
  inferenceMs: 0,
  personCount: 0,
  vehicleCount: 0,
  activeThreat: null,
  modelsLoaded: false,
  cameraActive: false,
};

export default function SurveillancePage() {
  // ── Persistent preferences ───────────────────
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // ── AI live telemetry ────────────────────────
  const [aiStats, setAiStats] = useState<AIStats>(DEFAULT_STATS);

  // ── Load from localStorage on mount ─────────
  useEffect(() => {
    const savedEmail = localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
    const savedAudio = localStorage.getItem(AUDIO_STORAGE_KEY);
    setRecipientEmail(savedEmail);
    setAudioEnabled(savedAudio !== 'false');
  }, []);

  // ── Persist email on change ──────────────────
  function handleEmailChange(email: string) {
    setRecipientEmail(email);
    localStorage.setItem(EMAIL_STORAGE_KEY, email);
  }

  // ── Toggle audio ─────────────────────────────
  function handleAudioToggle() {
    setAudioEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(AUDIO_STORAGE_KEY, String(next));
      return next;
    });
  }

  // ── Stats callback from CameraFeed ───────────
  const handleStatsUpdate = useCallback((stats: AIStats) => {
    setAiStats(stats);
  }, []);

  return (
    <main
      id="surveillance-console"
      className="flex flex-col h-screen w-screen overflow-hidden bg-background"
    >
      {/* ── Top bar ─────────────────────────────── */}
      <AlertHeader
        recipientEmail={recipientEmail}
        onEmailChange={handleEmailChange}
        audioEnabled={audioEnabled}
        onAudioToggle={handleAudioToggle}
        cameraActive={aiStats.cameraActive}
        systemOnline={aiStats.modelsLoaded}
      />

      {/* ── Telemetry bar ────────────────────────── */}
      <div className="flex items-center justify-center px-4 py-2 bg-background border-b border-slate-800/40">
        <ThreatStats
          fps={aiStats.fps}
          inferenceMs={aiStats.inferenceMs}
          personCount={aiStats.personCount}
          vehicleCount={aiStats.vehicleCount}
          activeThreat={aiStats.activeThreat}
          modelsLoaded={aiStats.modelsLoaded}
        />
      </div>

      {/* ── Main content: camera + drawer ────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Camera feed occupies remaining space */}
        <CameraFeed
          recipientEmail={recipientEmail}
          audioEnabled={audioEnabled}
          onStatsUpdate={handleStatsUpdate}
        />

        {/* Right-side incident drawer */}
        <IncidentDrawer />
      </div>
    </main>
  );
}
