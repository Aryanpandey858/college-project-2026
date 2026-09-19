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
    /* Backdrop — simple dark overlay, no backdrop-blur */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0, 0, 0, 0.75)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Evidence Inspector"
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <cfg.Icon size={16} style={{ color: incident.type === 'COMBAT' ? 'var(--danger)' : 'var(--warning)' }} />
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{incident.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={cfg.badgeClass}>{cfg.label}</span>
                <span
                  className="flex items-center gap-1"
                  style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-muted)' }}
                >
                  <Clock size={9} />
                  {formatTime(incident.created_at)}
                </span>
              </div>
            </div>
          </div>
          <button
            id="evidence-modal-close"
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: '6px', borderRadius: 6 }}
            aria-label="Close evidence inspector"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Snapshot ─────────────────────────── */}
        <div
          className={`relative m-4 rounded-lg overflow-hidden ${cfg.glowClass}`}
          style={{ border: `1px solid ${incident.type === 'COMBAT' ? 'var(--danger)' : incident.type === 'CUSTOM' ? 'var(--border-2)' : 'var(--warning)'}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={incident.snapshot_url}
            alt={`Evidence snapshot — ${incident.title}`}
            className="w-full h-auto block"
            loading="eager"
          />
          {/* Overlay timestamp */}
          <div
            className="absolute top-2 left-2 flex items-center gap-1.5 rounded px-2 py-1"
            style={{ background: 'rgba(0,0,0,0.65)', borderRadius: 4 }}
          >
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>REC</span>
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-secondary)' }}>{formatTime(incident.created_at)}</span>
          </div>
        </div>

        {/* ── Metadata Grid ────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mx-4 mb-4">

          {/* Confidence */}
          <MetaCard label="Detection Confidence">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="flex items-end justify-between">
                <span style={{ fontSize: 20, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{confidence}%</span>
                <span
                  style={{
                    fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
                    color: confidence >= 80 ? 'var(--danger)' : confidence >= 60 ? 'var(--warning)' : 'var(--accent)',
                  }}
                >
                  {confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Low'}
                </span>
              </div>
              <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%', borderRadius: 2,
                    width: `${confidence}%`,
                    background: confidence >= 80 ? 'var(--danger)' : confidence >= 60 ? 'var(--warning)' : 'var(--accent)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </MetaCard>

          {/* Incident ID */}
          <MetaCard label="Incident ID">
            <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{incident.id}</span>
          </MetaCard>

          {/* Description */}
          <div className="col-span-2">
            <MetaCard label="Detection Details">
              <p style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{incident.description}</p>
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
            className="btn-ghost"
            style={{ border: '1px solid var(--border-2)' }}
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
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span className="hud-label">{label}</span>
      <div>{children}</div>
    </div>
  );
}
