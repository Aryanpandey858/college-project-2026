'use client';

/**
 * EvidenceModal.tsx — Fullscreen snapshot inspector
 *
 * Opens when an incident card in the IncidentDrawer is clicked.
 * Shows:
 *  - Full-resolution evidence snapshot
 *  - Incident type badge, timestamp, confidence meter
 *  - Bounding box metadata
 *  - Copy / open link to the 30-minute live viewer
 */

import { useEffect, useCallback } from 'react';
import {
  X, ExternalLink, Copy, Clock, Shield, AlertTriangle, Car, Crosshair, type LucideIcon,
} from 'lucide-react';
import type { IncidentRecord } from '@/lib/types';

export interface EvidenceModalProps {
  incident: IncidentRecord | null;
  onClose: () => void;
}

const THREAT_CONFIG: Record<string, {
  label: string;
  Icon: LucideIcon;
  badgeClass: string;
  glowClass: string;
}> = {
  COMBAT:   { label: 'Combat / Brawl',    Icon: AlertTriangle, badgeClass: 'badge-danger',  glowClass: 'border-glow-danger' },
  WEAPON:   { label: 'Handheld Threat',   Icon: Crosshair,     badgeClass: 'badge-warning', glowClass: 'border-glow-warning' },
  ACCIDENT: { label: 'Vehicle Collision', Icon: Car,           badgeClass: 'badge-warning', glowClass: 'border-glow-warning' },
  CUSTOM:   { label: 'Custom Threat',     Icon: Shield,        badgeClass: 'badge-muted',   glowClass: '' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

export default function EvidenceModal({ incident, onClose }: EvidenceModalProps) {
  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!incident) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [incident, handleKey]);

  if (!incident) return null;

  const cfg = THREAT_CONFIG[incident.type] ?? THREAT_CONFIG.CUSTOM;
  const liveUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/live/${incident.live_token}`;
  const confidence = Math.round(incident.confidence * 100);

  function copyLink() {
    navigator.clipboard.writeText(liveUrl).catch(() => {});
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Evidence Inspector"
    >
      {/* Panel — stop click propagation */}
      <div
        className="glass relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700/60 shadow-glass"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <cfg.Icon size={16} className={incident.type === 'COMBAT' ? 'text-red-400' : 'text-amber-400'} />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{incident.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cfg.badgeClass}>{cfg.label}</span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                  <Clock size={9} />
                  {formatTime(incident.created_at)}
                </span>
              </div>
            </div>
          </div>
          <button
            id="evidence-modal-close"
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg"
            aria-label="Close evidence inspector"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Snapshot ─────────────────────────── */}
        <div className={`relative m-4 rounded-lg overflow-hidden border ${cfg.glowClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={incident.snapshot_url}
            alt={`Evidence snapshot — ${incident.title}`}
            className="w-full h-auto block"
            loading="eager"
          />
          {/* Overlay timestamp */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-danger" />
            <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest">REC</span>
            <span className="text-[9px] font-mono text-slate-300">{formatTime(incident.created_at)}</span>
          </div>
        </div>

        {/* ── Metadata Grid ────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mx-4 mb-4">

          {/* Confidence */}
          <MetaCard label="DETECTION CONFIDENCE">
            <div className="space-y-1.5">
              <div className="flex items-end justify-between">
                <span className="text-xl font-mono font-bold text-slate-100">{confidence}%</span>
                <span className={`text-xs font-mono ${confidence >= 80 ? 'text-red-400' : confidence >= 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {confidence >= 80 ? 'HIGH' : confidence >= 60 ? 'MEDIUM' : 'LOW'}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    confidence >= 80 ? 'bg-red-500' : confidence >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          </MetaCard>

          {/* Incident ID */}
          <MetaCard label="INCIDENT ID">
            <span className="text-xs font-mono text-slate-300 break-all">{incident.id}</span>
          </MetaCard>

          {/* Description */}
          <div className="col-span-2">
            <MetaCard label="DETECTION DETAILS">
              <p className="text-xs font-mono text-slate-400 leading-relaxed">{incident.description}</p>
            </MetaCard>
          </div>
        </div>

        {/* ── Actions ──────────────────────────── */}
        <div className="flex items-center gap-2 px-4 pb-4">
          <a
            id="evidence-live-view-btn"
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-danger flex-1 justify-center text-center"
          >
            <ExternalLink size={13} />
            Open Live Viewer
          </a>
          <button
            id="evidence-copy-link-btn"
            onClick={copyLink}
            className="btn-ghost border border-slate-700/60"
            title="Copy live viewer link"
          >
            <Copy size={13} />
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────

function MetaCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/60 rounded-lg p-3 space-y-1.5">
      <span className="hud-label">{label}</span>
      <div>{children}</div>
    </div>
  );
}
