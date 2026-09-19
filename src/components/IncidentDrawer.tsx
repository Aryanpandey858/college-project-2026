'use client';

/**
 * IncidentDrawer.tsx — Real-time incident history panel
 *
 * Subscribes to Supabase Realtime (INSERT events on public.incidents).
 * New incidents slide in from the right instantly without page refresh.
 *
 * Each card shows:
 *  - Threat type badge + icon
 *  - Incident title & description excerpt
 *  - Confidence score
 *  - Snapshot thumbnail
 *  - Relative timestamp
 *
 * Clicking a card opens EvidenceModal.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Car, Crosshair, Shield, Clock, ChevronRight, Inbox, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { IncidentRecord } from '@/lib/types';
import EvidenceModal from './EvidenceModal';

// Max number of incidents to keep in the local list
const MAX_INCIDENTS = 50;

const THREAT_CONFIG: Record<string, {
  label: string;
  Icon: LucideIcon;
  badgeClass: string;
  dotColor: string;
}> = {
  COMBAT:   { label: 'COMBAT',    Icon: AlertTriangle, badgeClass: 'badge-danger',  dotColor: 'bg-red-500' },
  WEAPON:   { label: 'WEAPON',    Icon: Crosshair,     badgeClass: 'badge-warning', dotColor: 'bg-amber-500' },
  ACCIDENT: { label: 'COLLISION', Icon: Car,           badgeClass: 'badge-warning', dotColor: 'bg-orange-500' },
  CUSTOM:   { label: 'CUSTOM',    Icon: Shield,        badgeClass: 'badge-muted',   dotColor: 'bg-slate-500' },
};

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function IncidentDrawer() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selected, setSelected] = useState<IncidentRecord | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Fetch recent incidents on mount ────────────────────────
  useEffect(() => {
    async function fetchRecent() {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_INCIDENTS);

      if (!error && data) {
        setIncidents(data as IncidentRecord[]);
      }
    }
    fetchRecent();
  }, []);

  // ── Subscribe to Supabase Realtime ─────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('public:incidents')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          const newIncident = payload.new as IncidentRecord;
          setIncidents((prev) => [newIncident, ...prev].slice(0, MAX_INCIDENTS));
          // Auto-scroll to top when new incident arrives
          listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <aside
        className="flex flex-col h-full w-72 xl:w-80 shrink-0"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
      >

        {/* ── Header ────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Incident Log
            </span>
            {incidents.length > 0 && (
              <span
                style={{
                  fontSize: 10, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
                  background: 'rgba(248, 81, 73, 0.12)', color: 'var(--danger)',
                  border: '1px solid rgba(248, 81, 73, 0.25)',
                  borderRadius: 4, padding: '0px 5px',
                }}
              >
                {incidents.length}
              </span>
            )}
          </div>

          {/* Realtime status */}
          <div
            className="flex items-center gap-1.5"
            title={realtimeConnected ? 'Realtime connected' : 'Connecting...'}
          >
            <span
              style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: realtimeConnected ? 'var(--accent)' : 'var(--text-muted)',
                animation: realtimeConnected ? 'blink-dot 2s ease-in-out infinite' : undefined,
              }}
            />
            <span
              style={{
                fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: realtimeConnected ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {realtimeConnected ? 'Live' : 'Sync'}
            </span>
          </div>
        </div>

        {/* ── Incident list ─────────────────────── */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {incidents.length === 0 ? (
            <EmptyState />
          ) : (
            incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onClick={() => setSelected(incident)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Evidence modal */}
      <EvidenceModal incident={selected} onClose={() => setSelected(null)} />
    </>
  );
}


// ── Sub-components ────────────────────────────────────────────

function IncidentCard({
  incident,
  onClick,
}: {
  incident: IncidentRecord;
  onClick: () => void;
}) {
  const cfg = THREAT_CONFIG[incident.type] ?? THREAT_CONFIG.CUSTOM;
  const confidence = Math.round(incident.confidence * 100);

  return (
    <button
      className="w-full flex items-start gap-3 px-4 py-3 text-left group animate-slide-in-right"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'transparent',
        transition: 'background 0.1s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      onClick={onClick}
      aria-label={`View evidence: ${incident.title}`}
    >
      {/* Snapshot thumbnail */}
      <div
        className="shrink-0 overflow-hidden"
        style={{
          width: 54, height: 38, borderRadius: 4,
          background: 'var(--bg)',
          border: '1px solid var(--border-2)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={incident.snapshot_url}
          alt="snapshot"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="flex items-center gap-1.5">
          <span className={cfg.badgeClass}>{cfg.label}</span>
          <span
            style={{
              fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
              color: 'var(--text-muted)',
            }}
          >
            {confidence}%
          </span>
        </div>
        <p
          className="truncate"
          style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}
        >
          {incident.title}
        </p>
        <div
          className="flex items-center gap-1"
          style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-muted)' }}
        >
          <Clock size={8} />
          <span>{relativeTime(incident.created_at)}</span>
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight
        size={13}
        className="shrink-0"
        style={{ color: 'var(--text-muted)', marginTop: 4, transition: 'color 0.1s' }}
      />
    </button>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full py-16 px-6 text-center"
      style={{ gap: 12 }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--surface-2)', border: '1px solid var(--border-2)',
        }}
      >
        <Inbox size={18} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>No incidents yet</p>
        <p
          style={{
            fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
            color: 'var(--text-muted)', lineHeight: 1.5,
          }}
        >
          Monitoring active. Alerts will appear here in real-time.
        </p>
      </div>
    </div>
  );
}
