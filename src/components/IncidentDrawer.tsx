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
      <aside className="glass border-l border-slate-800/60 flex flex-col h-full w-72 xl:w-80 shrink-0 rounded-none">

        {/* ── Header ────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="hud-label">Incident Log</span>
            {incidents.length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-950/60 text-red-400 border border-red-800/40 rounded text-[10px] font-mono font-semibold">
                {incidents.length}
              </span>
            )}
          </div>
          {/* Realtime status */}
          <div className="flex items-center gap-1.5" title={realtimeConnected ? 'Realtime connected' : 'Connecting...'}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse-neon' : 'bg-slate-600 animate-pulse'}`}
            />
            <span className={`text-[9px] font-mono uppercase tracking-widest ${realtimeConnected ? 'text-emerald-500' : 'text-slate-600'}`}>
              {realtimeConnected ? 'LIVE' : 'SYNC'}
            </span>
          </div>
        </div>

        {/* ── Incident list ─────────────────────── */}
        <div ref={listRef} className="flex-1 overflow-y-auto space-y-0 divide-y divide-slate-800/40">
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
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left group animate-slide-in-right"
      onClick={onClick}
      aria-label={`View evidence: ${incident.title}`}
    >
      {/* Snapshot thumbnail */}
      <div className="w-14 h-10 rounded overflow-hidden shrink-0 bg-slate-800 border border-slate-700/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={incident.snapshot_url}
          alt="snapshot"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className={cfg.badgeClass}>{cfg.label}</span>
          <span className="text-[10px] font-mono text-slate-600">{confidence}%</span>
        </div>
        <p className="text-xs text-slate-300 truncate font-medium">{incident.title}</p>
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-600">
          <Clock size={8} />
          <span>{relativeTime(incident.created_at)}</span>
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight
        size={14}
        className="text-slate-700 group-hover:text-slate-400 transition-colors shrink-0 mt-2"
      />
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center">
        <Inbox size={20} className="text-slate-600" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500">No incidents yet</p>
        <p className="text-[10px] text-slate-700 mt-1 font-mono">
          Monitoring active — alerts will appear here in real-time
        </p>
      </div>
    </div>
  );
}
