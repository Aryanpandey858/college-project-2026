'use client';

import { Activity, Cpu, Users, Car, Zap } from 'lucide-react';
import type { ThreatType } from '@/lib/types';

export interface ThreatStatsProps {
  fps: number;
  inferenceMs: number;
  personCount: number;
  vehicleCount: number;
  activeThreat: ThreatType | null;
  modelsLoaded: boolean;
}

const THREAT_LABELS: Record<string, { label: string; color: string }> = {
  COMBAT:   { label: 'COMBAT DETECTED',   color: 'text-red-400' },
  WEAPON:   { label: 'WEAPON DETECTED',   color: 'text-amber-400' },
  ACCIDENT: { label: 'COLLISION DETECTED', color: 'text-orange-400' },
};

export default function ThreatStats({
  fps,
  inferenceMs,
  personCount,
  vehicleCount,
  activeThreat,
  modelsLoaded,
}: ThreatStatsProps) {
  const fpsColor =
    fps >= 12 ? 'text-emerald-400' :
    fps >= 7  ? 'text-amber-400'   :
                'text-red-400';

  const latencyColor =
    inferenceMs < 60  ? 'text-emerald-400' :
    inferenceMs < 120 ? 'text-amber-400'   :
                        'text-red-400';

  return (
    <div className="glass border border-slate-800/60 flex items-center gap-0 overflow-hidden">

      {/* Model status */}
      <StatCell icon={<Cpu size={13} />} label="MODEL">
        {modelsLoaded ? (
          <span className="text-emerald-400 font-mono text-xs font-semibold tracking-wider">READY</span>
        ) : (
          <span className="text-amber-400 font-mono text-xs font-semibold tracking-wider animate-pulse">LOADING</span>
        )}
      </StatCell>

      <Divider />

      {/* FPS */}
      <StatCell icon={<Activity size={13} />} label="FPS">
        <span className={`font-mono text-sm font-bold tabular-nums ${fpsColor}`}>
          {fps.toFixed(0)}
        </span>
      </StatCell>

      <Divider />

      {/* Inference latency */}
      <StatCell icon={<Zap size={13} />} label="LATENCY">
        <span className={`font-mono text-sm font-bold tabular-nums ${latencyColor}`}>
          {inferenceMs > 0 ? `${inferenceMs.toFixed(0)}ms` : '—'}
        </span>
      </StatCell>

      <Divider />

      {/* Person count */}
      <StatCell icon={<Users size={13} />} label="PERSONS">
        <span className="font-mono text-sm font-bold text-slate-200 tabular-nums">
          {personCount}
        </span>
      </StatCell>

      <Divider />

      {/* Vehicle count */}
      <StatCell icon={<Car size={13} />} label="VEHICLES">
        <span className="font-mono text-sm font-bold text-slate-200 tabular-nums">
          {vehicleCount}
        </span>
      </StatCell>

      {/* Active threat banner — only shown when threat is active */}
      {activeThreat && (
        <>
          <Divider />
          <div className="flex items-center gap-2 px-4 py-2 bg-red-950/40">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-danger" />
            <span className={`font-mono text-xs font-bold tracking-widest ${THREAT_LABELS[activeThreat].color}`}>
              ⚠ {THREAT_LABELS[activeThreat].label}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Divider() {
  return <div className="w-px self-stretch bg-slate-800/60" />;
}

function StatCell({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-4 py-2 min-w-[72px]">
      <div className="flex items-center gap-1 text-slate-600">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600">
          {label}
        </span>
      </div>
      <div className="flex items-center justify-center">{children}</div>
    </div>
  );
}
