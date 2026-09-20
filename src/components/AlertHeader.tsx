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

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Mail, Shield, Wifi, WifiOff } from 'lucide-react';

export interface AlertHeaderProps {
  recipientEmail: string;
  onEmailChange: (email: string) => void;
  audioEnabled: boolean;
  onAudioToggle: () => void;
  cameraActive: boolean;
  systemOnline: boolean;
}

export default function AlertHeader({
  recipientEmail,
  onEmailChange,
  audioEnabled,
  onAudioToggle,
  cameraActive,
  systemOnline,
}: AlertHeaderProps) {
  const [emailDraft, setEmailDraft] = useState(recipientEmail);
  const [emailFocused, setEmailFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when prop changes (e.g., loaded from localStorage on mount)
  useEffect(() => {
    setEmailDraft(recipientEmail);
  }, [recipientEmail]);

  function handleEmailSubmit() {
    if (emailDraft.trim() && emailDraft !== recipientEmail) {
      onEmailChange(emailDraft.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleEmailSubmit();
    if (e.key === 'Escape') {
      setEmailDraft(recipientEmail);
      inputRef.current?.blur();
    }
  }

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

      {/* ── Center: Email recipient input ─────── */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <Mail size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id="alert-recipient-email"
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => { setEmailFocused(false); handleEmailSubmit(); }}
            onKeyDown={handleKeyDown}
            placeholder="alert-recipient@example.com"
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: `1px solid ${emailFocused ? 'var(--accent)' : 'var(--border-2)'}`,
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              fontFamily: '"JetBrains Mono", monospace',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.12s',
            }}
          />
          {saved && (
            <span
              className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-fade-in"
              style={{ fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--accent)' }}
            >
              Saved ✓
            </span>
          )}
        </div>
        <span
          className="hidden md:block"
          style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace',
                   textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
        >
          Alert Recipient
        </span>
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
