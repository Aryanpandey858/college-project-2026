'use client';

/**
 * AlertHeader.tsx — Top glassmorphic cockpit control bar
 *
 * Features:
 *  - Recipient email input (persisted in localStorage)
 *  - Audio alert toggle
 *  - Camera active / system health status indicator
 *  - SentinelAI brand mark with radar sweep animation
 */

import { Bell, BellOff, Shield, Wifi, WifiOff } from 'lucide-react';

export interface AlertHeaderProps {
  audioEnabled: boolean;
  onAudioToggle: () => void;
  cameraActive: boolean;
  systemOnline: boolean;
}

export default function AlertHeader({
  audioEnabled,
  onAudioToggle,
  cameraActive,
  systemOnline,
}: AlertHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-5 py-3 gap-6 z-30 relative shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >

      {/* ── Brand ────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Simple static shield — no spinning animation */}
        <div
          className="w-9 h-9 flex items-center justify-center rounded-md"
          style={{ background: 'rgba(63, 185, 80, 0.1)', border: '1px solid rgba(63, 185, 80, 0.25)' }}
        >
          <Shield size={18} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex flex-col leading-none gap-0.5">
          <span className="text-base font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            SentinelAI
          </span>
          <span className="hud-label" style={{ fontSize: '10px' }}>
            Surveillance Platform
          </span>
        </div>
      </div>

      {/* ── Right: Status + Controls ──────────── */}
      <div className="flex items-center gap-4 shrink-0">

        {/* Camera status */}
        <div className="flex items-center gap-1.5">
          {cameraActive ? (
            <>
              <span className="live-dot" />
              <span className="hud-label" style={{ color: 'var(--danger)' }}>Live</span>
            </>
          ) : (
            <>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)' }} />
              <span className="hud-label">Offline</span>
            </>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-2)' }} />

        {/* AI system status */}
        <div
          className="flex items-center gap-1.5"
          title={systemOnline ? 'AI models ready' : 'AI models loading'}
        >
          {systemOnline ? (
            <Wifi size={15} style={{ color: 'var(--accent)' }} />
          ) : (
            <WifiOff size={15} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        {/* Audio toggle */}
        <button
          id="audio-toggle-btn"
          onClick={onAudioToggle}
          className="btn-ghost"
          style={{
            padding: '7px',
            borderRadius: '6px',
            color: audioEnabled ? 'var(--accent)' : 'var(--text-muted)',
          }}
          title={audioEnabled ? 'Mute alerts' : 'Enable audio alerts'}
          aria-label="Toggle audio alerts"
        >
          {audioEnabled ? <Bell size={16} /> : <BellOff size={16} />}
        </button>

        {/* Version — simple text, no border */}
        <span
          className="hidden lg:inline"
          style={{ fontSize: '10px', fontFamily: '"JetBrains Mono", monospace',
                   color: 'var(--text-muted)', letterSpacing: '0.05em' }}
        >
          v1.0
        </span>
      </div>
    </header>
  );
}
