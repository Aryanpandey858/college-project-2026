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
  COMBAT:   { label: 'Combat Detected',   color: 'var(--danger)' },
  WEAPON:   { label: 'Weapon Detected',   color: 'var(--warning)' },
  ACCIDENT: { label: 'Collision Detected', color: 'var(--warning)' },
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
    fps >= 12 ? 'var(--accent)' :
    fps >= 7  ? 'var(--warning)' :
                'var(--danger)';

  const latencyColor =
    inferenceMs < 60  ? 'var(--accent)' :
    inferenceMs < 120 ? 'var(--warning)' :
                        'var(--danger)';

  return (
    <div
      className="flex items-center"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >

      {/* Model status */}
      <StatCell icon={<Cpu size={12} />} label="Model">
        {modelsLoaded ? (
          <span style={{ color: 'var(--accent)', fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600 }}>
            Ready
          </span>
        ) : (
          <span className="animate-pulse" style={{ color: 'var(--warning)', fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600 }}>
            Loading
          </span>
        )}
      </StatCell>

      <Divider />

      {/* FPS */}
      <StatCell icon={<Activity size={12} />} label="FPS">
        <span style={{ color: fpsColor, fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700 }}>
          {fps.toFixed(0)}
        </span>
      </StatCell>

      <Divider />

      {/* Inference latency */}
      <StatCell icon={<Zap size={12} />} label="Latency">
        <span style={{ color: latencyColor, fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700 }}>
          {inferenceMs > 0 ? `${inferenceMs.toFixed(0)}ms` : '—'}
        </span>
      </StatCell>

      <Divider />

      {/* Person count */}
      <StatCell icon={<Users size={12} />} label="Persons">
        <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700 }}>
          {personCount}
        </span>
      </StatCell>

      <Divider />

      {/* Vehicle count */}
      <StatCell icon={<Car size={12} />} label="Vehicles">
        <span style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700 }}>
          {vehicleCount}
        </span>
      </StatCell>

      {/* Active threat banner */}
      {activeThreat && (
        <>
          <Divider />
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{ background: 'rgba(248, 81, 73, 0.08)' }}
          >
            {/* Static dot — no animation cost during threat */}
            <span
              style={{
                display: 'inline-block', width: 7, height: 7,
                borderRadius: '50%', background: 'var(--danger)',
                animation: 'blink-dot 1.2s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                fontWeight: 700,
                color: THREAT_LABELS[activeThreat].color,
                letterSpacing: '0.04em',
              }}
            >
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
  return (
    <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
  );
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
    <div
      className="flex flex-col items-center justify-center gap-0.5 px-4 py-2"
      style={{ minWidth: 72 }}
    >
      <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
        {icon}
        <span
          style={{
            fontSize: 9,
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center justify-center">{children}</div>
    </div>
  );
}

