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
import { Bell, BellOff, Mail, Radio, Shield, Wifi, WifiOff } from 'lucide-react';

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
    <header className="glass border-b border-slate-800/60 flex items-center justify-between px-4 py-2.5 gap-4 z-30 relative rounded-none">

      {/* ── Brand ────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Radar icon with sweep animation */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-emerald-500/30" />
          <div
            className="absolute inset-0 rounded-full border-t-2 border-emerald-400/70"
            style={{ animation: 'radar-sweep 3s linear infinite' }}
          />
          <Shield size={14} className="text-emerald-400 relative z-10" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold text-slate-100 tracking-tight">SentinelAI</span>
          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
            Surveillance Platform
          </span>
        </div>
      </div>

      {/* ── Center: Email recipient input ─────── */}
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <Mail size={13} className="text-slate-500 shrink-0" />
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
            className={`
              w-full bg-slate-900/60 border rounded-lg px-3 py-1.5
              text-sm font-mono text-slate-200 placeholder-slate-600
              outline-none transition-all duration-200
              ${emailFocused
                ? 'border-emerald-500/60 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]'
                : 'border-slate-700/60 hover:border-slate-600/60'}
            `}
          />
          {saved && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-emerald-400 animate-fade-in">
              SAVED ✓
            </span>
          )}
        </div>
        <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest whitespace-nowrap hidden md:block">
          Alert Recipient
        </span>
      </div>

      {/* ── Right: Status + Controls ──────────── */}
      <div className="flex items-center gap-3 shrink-0">

        {/* Camera status */}
        <div className="flex items-center gap-1.5">
          {cameraActive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ animation: 'pulse-danger 1.2s ease-in-out infinite' }} />
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-400">LIVE</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">OFFLINE</span>
            </>
          )}
        </div>

        <div className="w-px h-5 bg-slate-700/60" />

        {/* System online indicator */}
        <div className="flex items-center gap-1.5" title={systemOnline ? 'AI systems online' : 'AI systems offline'}>
          {systemOnline ? (
            <Wifi size={13} className="text-emerald-400" />
          ) : (
            <WifiOff size={13} className="text-slate-600" />
          )}
        </div>

        {/* Audio toggle */}
        <button
          id="audio-toggle-btn"
          onClick={onAudioToggle}
          className={`btn-ghost p-1.5 rounded-lg transition-all ${audioEnabled ? 'text-emerald-400' : 'text-slate-600'}`}
          title={audioEnabled ? 'Mute alerts' : 'Enable audio alerts'}
          aria-label="Toggle audio alerts"
        >
          {audioEnabled ? <Bell size={14} /> : <BellOff size={14} />}
        </button>

        {/* Version tag */}
        <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-md border border-slate-700/40">
          <Radio size={10} className="text-slate-500" />
          <span className="text-[9px] font-mono text-slate-500 tracking-widest">v1.0</span>
        </div>
      </div>
    </header>
  );
}
