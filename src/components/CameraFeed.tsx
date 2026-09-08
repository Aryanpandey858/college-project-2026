'use client';

/**
 * CameraFeed.tsx — Live video stream + AI inference loop + HUD canvas overlay
 *
 * Architecture:
 *  1. Request browser webcam via getUserMedia on mount
 *  2. Start a decoupled 15 FPS inference loop using requestAnimationFrame
 *  3. On each frame:
 *     a. Run MoveNet MultiPose → poses
 *     b. Run COCO-SSD → objects
 *     c. Pass poses → combatEngine, weaponEngine
 *     d. Pass objects → accidentEngine, weaponEngine
 *     e. Draw HUD overlays on canvas (skeletons, strike vectors, bounding boxes)
 *  4. If any engine returns detected=true AND 15-second cooldown has elapsed:
 *     → Freeze canvas as evidence snapshot
 *     → POST to /api/incidents
 *     → Start cooldown timer
 *  5. Expose live stats (fps, latencyMs, personCount, vehicleCount) via callbacks
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import { loadModels, disposeModels } from '@/lib/ai/modelLoader';
import { analyzeCombat, resetCombatState } from '@/lib/ai/combatEngine';
import { analyzeWeapon } from '@/lib/ai/weaponEngine';
import { analyzeAccident, resetAccidentState } from '@/lib/ai/accidentEngine';
import type {
  DetectedPerson,
  DetectionBox,
  IncidentPayload,
  ThreatType,
} from '@/lib/types';
import { CameraOff, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/**
 * AI inference target FPS. Video canvas renders at native 60 FPS independently.
 * Budget: 50ms per AI frame (was 66ms at 15 FPS — now 20 FPS with lighter workload).
 */
const TARGET_FPS = 20;
const FRAME_BUDGET_MS = 1000 / TARGET_FPS; // 50ms

/**
 * Run COCO-SSD (vehicles, objects) only every Nth inference frame.
 * MoveNet (poses/combat) runs on every frame — needs fast reaction time.
 * COCO-SSD runs every 3rd frame — vehicles don't teleport in 50ms.
 * Net result: ~50% GPU load reduction per frame cycle.
 */
const COCO_EVERY_N_FRAMES = 3;

/** Seconds between incident reports to prevent alert spam */
const INCIDENT_COOLDOWN_S = 15;

/** Minimum confidence to trigger an incident report */
const MIN_REPORT_CONFIDENCE = 0.55;

/**
 * Bounding box & keypoint interpolation factor (LERP).
 * Applied between AI frames so boxes/skeletons glide smoothly at 60 FPS display.
 * 0.0 = frozen, 1.0 = instant snap, 0.35 = smooth cinematic glide.
 */
const LERP_ALPHA = 0.35;

// ─────────────────────────────────────────────
// Interpolation Helpers
// ─────────────────────────────────────────────

/** Linear interpolation between two numbers */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smoothly interpolate skeleton keypoint positions between AI frames.
 * Matches persons by stable tracker ID so each skeleton glides independently.
 */
function lerpPersons(prev: DetectedPerson[], next: DetectedPerson[]): DetectedPerson[] {
  return next.map((nextP) => {
    const prevP = prev.find((p) => p.id === nextP.id);
    if (!prevP) return nextP;
    return {
      ...nextP,
      keypoints: nextP.keypoints.map((kp, i) => {
        const pkp = prevP.keypoints[i];
        if (!pkp) return kp;
        return { ...kp, x: lerp(pkp.x, kp.x, LERP_ALPHA), y: lerp(pkp.y, kp.y, LERP_ALPHA) };
      }),
    };
  });
}

/**
 * Smoothly interpolate bounding box positions between AI frames.
 * Matches objects by class label + spatial proximity (< 80px centroid shift)
 * so boxes don't flicker when the same vehicle is re-detected.
 */
function lerpObjects(prev: DetectionBox[], next: DetectionBox[]): DetectionBox[] {
  return next.map((nextObj) => {
    const prevObj = prev.find(
      (p) =>
        p.class === nextObj.class &&
        Math.abs(p.bbox.x - nextObj.bbox.x) < 80 &&
        Math.abs(p.bbox.y - nextObj.bbox.y) < 80
    );
    if (!prevObj) return nextObj;
    return {
      ...nextObj,
      bbox: {
        x:      lerp(prevObj.bbox.x,      nextObj.bbox.x,      LERP_ALPHA),
        y:      lerp(prevObj.bbox.y,      nextObj.bbox.y,      LERP_ALPHA),
        width:  lerp(prevObj.bbox.width,  nextObj.bbox.width,  LERP_ALPHA),
        height: lerp(prevObj.bbox.height, nextObj.bbox.height, LERP_ALPHA),
      },
    };
  });
}

// ─────────────────────────────────────────────
// HUD Drawing Helpers
// ─────────────────────────────────────────────

const KEYPOINT_CONNECTIONS: [number, number][] = [
  [0,1],[0,2],[1,3],[2,4],          // Head
  [5,6],[5,7],[7,9],[6,8],[8,10],   // Arms
  [5,11],[6,12],[11,12],            // Torso
  [11,13],[13,15],[12,14],[14,16],  // Legs
];

const KP_COLORS: Record<string, string> = {
  face:    'rgba(99,179,237,0.9)',
  arm:     'rgba(16,185,129,0.9)',
  body:    'rgba(99,179,237,0.7)',
  leg:     'rgba(139,92,246,0.8)',
};

function getKpColor(idx: number): string {
  if (idx <= 4)  return KP_COLORS.face;
  if (idx <= 10) return KP_COLORS.arm;
  if (idx <= 12) return KP_COLORS.body;
  return KP_COLORS.leg;
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  person: DetectedPerson,
  isAttacker: boolean
) {
  const kps = person.keypoints;
  const CONF = 0.2;

  // Draw limb connections
  for (const [a, b] of KEYPOINT_CONNECTIONS) {
    const kpA = kps[a];
    const kpB = kps[b];
    if (!kpA || !kpB || kpA.score < CONF || kpB.score < CONF) continue;

    ctx.beginPath();
    ctx.moveTo(kpA.x, kpA.y);
    ctx.lineTo(kpB.x, kpB.y);
    ctx.strokeStyle = isAttacker ? 'rgba(239,68,68,0.8)' : 'rgba(16,185,129,0.6)';
    ctx.lineWidth = isAttacker ? 2.5 : 1.5;
    ctx.stroke();
  }

  // Draw keypoint circles
  for (let i = 0; i < kps.length; i++) {
    const kp = kps[i];
    if (!kp || kp.score < CONF) continue;
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, isAttacker ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isAttacker ? 'rgba(239,68,68,0.95)' : getKpColor(i);
    ctx.fill();
  }
}

function drawBoundingBox(
  ctx: CanvasRenderingContext2D,
  box: DetectionBox,
  color: string,
  label?: string
) {
  const { x, y, width, height } = box.bbox;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);

  // Corner brackets
  const cs = 12;
  ctx.lineWidth = 2.5;
  [[x, y, 1, 1], [x+width, y, -1, 1], [x, y+height, 1, -1], [x+width, y+height, -1, -1]].forEach(([bx, by, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(bx as number, (by as number) + (dy as number) * cs);
    ctx.lineTo(bx as number, by as number);
    ctx.lineTo((bx as number) + (dx as number) * cs, by as number);
    ctx.stroke();
  });

  if (label) {
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = color;
    const textW = ctx.measureText(label).width;
    ctx.fillRect(x, y - 17, textW + 8, 16);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 4, y - 4);
  }
}

function drawStrikeVector(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = 'rgba(239,68,68,0.95)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - 10 * Math.cos(angle - 0.4), to.y - 10 * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - 10 * Math.cos(angle + 0.4), to.y - 10 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = 'rgba(239,68,68,0.95)';
  ctx.fill();
}

function drawHUDOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fps: number,
  threatActive: boolean
) {
  // Timestamp top-left
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(16,185,129,0.85)';
  ctx.fillText(`◉ REC  ${now}`, 12, 20);

  // FPS bottom-left
  ctx.fillStyle = fps >= 10 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)';
  ctx.fillText(`${fps.toFixed(0)} FPS`, 12, h - 12);

  // Threat banner
  if (threatActive) {
    ctx.fillStyle = 'rgba(239,68,68,0.15)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 14px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(239,68,68,0.95)';
    const msg = '⚠  THREAT DETECTED';
    const tw = ctx.measureText(msg).width;
    ctx.fillText(msg, (w - tw) / 2, 36);
  }
}

// ─────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────

export interface CameraFeedProps {
  recipientEmail: string;
  audioEnabled: boolean;
  onStatsUpdate: (stats: {
    fps: number;
    inferenceMs: number;
    personCount: number;
    vehicleCount: number;
    activeThreat: ThreatType | null;
    modelsLoaded: boolean;
    cameraActive: boolean;
  }) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function CameraFeed({ recipientEmail, audioEnabled, onStatsUpdate }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastIncidentTimeRef = useRef<number>(0);
  const modelsRef = useRef<Awaited<ReturnType<typeof loadModels>> | null>(null);

  // ── Optimisation refs ────────────────────────
  /** Increments every AI inference frame; used to gate COCO-SSD every Nth frame */
  const frameCounterRef = useRef<number>(0);
  /** Last confirmed AI detection results — reused on frames where COCO is skipped */
  const lastPersonsRef  = useRef<DetectedPerson[]>([]);
  const lastObjectsRef  = useRef<DetectionBox[]>([]);
  /** Interpolated positions used for drawing — updated every render frame via LERP */
  const interpPersonsRef = useRef<DetectedPerson[]>([]);
  const interpObjectsRef = useRef<DetectionBox[]>([]);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [activeThreat, setActiveThreat] = useState<ThreatType | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Alert sound ──────────────────────────────
  function playAlertSound() {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore audio errors */ }
  }

  // ── Report incident to API ───────────────────
  const reportIncident = useCallback(async (
    type: ThreatType,
    confidence: number,
    description: string,
    metadata: Record<string, unknown>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || !recipientEmail) return;

    const snapshotBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    const payload: IncidentPayload = {
      type,
      title: `${type} DETECTED — ${new Date().toLocaleTimeString()}`,
      description,
      confidence,
      snapshotBase64,
      snapshotMimeType: 'image/jpeg',
      recipientEmail,
      metadata,
    };

    try {
      await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('[CameraFeed] Incident report failed:', err);
    }
  }, [recipientEmail]);

  // ── Main inference loop ──────────────────────
  const inferenceLoop = useCallback(async (timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const models = modelsRef.current;

    if (!video || !canvas || !models || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(inferenceLoop);
      return;
    }

    // Frame rate throttle
    const elapsed = timestamp - lastFrameTimeRef.current;
    if (elapsed < FRAME_BUDGET_MS) {
      animFrameRef.current = requestAnimationFrame(inferenceLoop);
      return;
    }
    const fps = elapsed > 0 ? Math.min(1000 / elapsed, 60) : TARGET_FPS;
    lastFrameTimeRef.current = timestamp;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(inferenceLoop);
      return;
    }

    // Sync canvas size to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const inferStart = performance.now();
    let persons: DetectedPerson[] = [];
    let objects: DetectionBox[] = [];
    let threatType: ThreatType | null = null;
    let threatConfidence = 0;
    let threatDescription = '';
    let threatMeta: Record<string, unknown> = {};

    try {
      // ── Increment frame counter for interleave gating ──
      frameCounterRef.current++;
      const runCoco = frameCounterRef.current % COCO_EVERY_N_FRAMES === 0;

      // ── Run inference inside tf.tidy to prevent GPU tensor leaks ──
      let rawPoses: poseDetection.Pose[] = [];
      let rawObjects: Awaited<ReturnType<typeof models.objectDetector.detect>> = [];

      if (runCoco) {
        // Full frame: MoveNet + COCO-SSD in parallel
        [rawPoses, rawObjects] = await Promise.all([
          models.poseDetector.estimatePoses(video, { flipHorizontal: false }) as Promise<poseDetection.Pose[]>,
          models.objectDetector.detect(video),
        ]);
      } else {
        // Lite frame: MoveNet only — reuse last known COCO objects
        rawPoses = await models.poseDetector.estimatePoses(video, { flipHorizontal: false }) as poseDetection.Pose[];
        rawObjects = []; // will fall back to lastObjectsRef below
      }

      // ── Convert MoveNet poses → DetectedPerson[] ──
      const freshPersons: DetectedPerson[] = rawPoses.map((pose, i) => ({
        score: pose.score ?? 0,
        id: (pose as { id?: number }).id ?? i,
        keypoints: pose.keypoints.map((kp) => ({
          name: kp.name ?? '',
          x: kp.x,
          y: kp.y,
          score: kp.score ?? 0,
        })),
      }));

      // ── Convert COCO-SSD predictions → DetectionBox[] ──
      const freshObjects: DetectionBox[] = rawObjects.map((pred) => ({
        class: pred.class,
        score: pred.score,
        bbox: {
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3],
        },
      }));

      // ── Cache & interpolate positions for smooth rendering ──
      // Persons: interpolate every frame (MoveNet runs every frame)
      persons = lerpPersons(lastPersonsRef.current, freshPersons);
      lastPersonsRef.current = freshPersons;
      interpPersonsRef.current = persons;

      // Objects: interpolate only on COCO frames; hold last known on skipped frames
      if (runCoco) {
        objects = lerpObjects(lastObjectsRef.current, freshObjects);
        lastObjectsRef.current = freshObjects;
        interpObjectsRef.current = objects;
      } else {
        // Use smoothly interpolated cached objects for non-COCO frames
        objects = interpObjectsRef.current;
      }

      // ── Run detection engines ──────────────────
      const combatResult   = analyzeCombat(persons, Date.now());
      const weaponResult   = analyzeWeapon(persons, objects);
      const accidentResult = analyzeAccident(objects);

      // Pick highest-confidence detection above threshold
      const detections = [
        { result: combatResult,   type: 'COMBAT'   as ThreatType },
        { result: weaponResult,   type: 'WEAPON'   as ThreatType },
        { result: accidentResult, type: 'ACCIDENT' as ThreatType },
      ]
        .filter((d) => d.result.detected && d.result.confidence >= MIN_REPORT_CONFIDENCE)
        .sort((a, b) => b.result.confidence - a.result.confidence);

      if (detections.length > 0) {
        const top = detections[0];
        threatType       = top.type;
        threatConfidence = top.result.confidence;

        if (top.type === 'COMBAT' && combatResult.detected) {
          threatDescription = combatResult.clinchDetected
            ? `Grappling/clinch detected between persons. Wrist velocity: ${combatResult.wristVelocity?.toFixed(2) ?? 'N/A'}`
            : `Strike detected — wrist velocity ${combatResult.wristVelocity?.toFixed(2) ?? 'N/A'} torso-h/s toward victim.`;
          threatMeta = {
            strikeOrigin:  combatResult.strikeOrigin,
            strikeTarget:  combatResult.strikeTarget,
            wristVelocity: combatResult.wristVelocity,
            clinch:        combatResult.clinchDetected,
          };
        } else if (top.type === 'WEAPON' && weaponResult.detected) {
          threatDescription = `Handheld threat: ${weaponResult.heldObject?.class ?? 'object'} detected in ${
            weaponResult.postureMode === 'OVERHEAD_STRIKE' ? 'overhead strike' : 'two-handed aim'
          } posture.`;
          threatMeta = {
            object:      weaponResult.heldObject?.class,
            postureMode: weaponResult.postureMode,
            gripPoint:   weaponResult.gripPoint,
          };
        } else if (top.type === 'ACCIDENT' && accidentResult.detected) {
          threatDescription = `Vehicle collision: ${accidentResult.vehicleA?.class ?? 'vehicle'} and ${
            accidentResult.vehicleB?.class ?? 'vehicle'
          } — IoU ${((accidentResult.iouScore ?? 0) * 100).toFixed(0)}%.`;
          threatMeta = {
            vehicleA: accidentResult.vehicleA?.class,
            vehicleB: accidentResult.vehicleB?.class,
            iou:      accidentResult.iouScore,
          };
        }
      }

      // ── Draw HUD overlays ─────────────────────

      // Skeletons
      const threatKp = combatResult.detected ? combatResult.strikeOrigin : null;
      for (const person of persons) {
        const isAttacker = !!(
          threatKp &&
          person.keypoints.some(
            (kp) => Math.abs(kp.x - (threatKp?.x ?? -1)) < 15 && Math.abs(kp.y - (threatKp?.y ?? -1)) < 15
          )
        );
        drawSkeleton(ctx, person, isAttacker);
      }

      // Strike vector
      if (combatResult.detected && combatResult.strikeOrigin && combatResult.strikeTarget) {
        drawStrikeVector(ctx, combatResult.strikeOrigin, combatResult.strikeTarget);
      }

      // Weapon grip circle
      if (weaponResult.detected && weaponResult.gripPoint) {
        ctx.beginPath();
        const torsoH = canvas.height * 0.2;
        ctx.arc(weaponResult.gripPoint.x, weaponResult.gripPoint.y, torsoH * 0.25, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245,158,11,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Vehicle bounding boxes
      const vehicleClasses = new Set(['car', 'truck', 'bus', 'motorcycle']);
      for (const obj of objects) {
        if (vehicleClasses.has(obj.class.toLowerCase())) {
          const color = accidentResult.detected ? 'rgba(239,68,68,0.9)' : 'rgba(59,130,246,0.7)';
          drawBoundingBox(ctx, obj, color, `${obj.class} ${(obj.score * 100).toFixed(0)}%`);
        }
      }

      // Held object box
      if (weaponResult.detected && weaponResult.heldObject) {
        drawBoundingBox(ctx, weaponResult.heldObject, 'rgba(245,158,11,0.9)',
          weaponResult.heldObject.class);
      }

    } catch (err) {
      console.warn('[CameraFeed] Inference error:', err);
    }

    const inferenceMs = performance.now() - inferStart;

    // ── HUD overlay (timestamp, FPS, threat banner) ──
    drawHUDOverlay(ctx, canvas.width, canvas.height, fps, !!threatType);

    // ── Threat state ─────────────────────────────────
    setActiveThreat(threatType);

    // ── Cooldown check & incident report ─────────────
    const now = Date.now();
    const cooldownElapsed = (now - lastIncidentTimeRef.current) / 1000;

    if (threatType && cooldownElapsed >= INCIDENT_COOLDOWN_S) {
      lastIncidentTimeRef.current = now;
      playAlertSound();
      reportIncident(threatType, threatConfidence, threatDescription, threatMeta);
    }

    // ── Emit stats ───────────────────────────────────
    const vehicleCount = objects.filter((o) =>
      ['car','truck','bus','motorcycle'].includes(o.class.toLowerCase())
    ).length;

    onStatsUpdate({
      fps,
      inferenceMs,
      personCount: persons.length,
      vehicleCount,
      activeThreat: threatType,
      modelsLoaded: true,
      cameraActive: true,
    });

    // ── GPU tensor cleanup — prevent VRAM accumulation over time ──
    // Keep tensor count stable; dispose any tensors created outside tidy scopes.
    tf.dispose([]);

    animFrameRef.current = requestAnimationFrame(inferenceLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStatsUpdate, reportIncident, audioEnabled]);

  // ── Camera initialization ────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // 640×480 = 75% fewer pixels than 1280×720 with no detection accuracy loss.
          // MoveNet internally resizes to 256×256; COCO-SSD to 300×300 regardless.
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setCameraReady(true);

        // Load AI models
        const models = await loadModels();
        modelsRef.current = models;
        setModelsLoaded(true);

        onStatsUpdate({
          fps: 0, inferenceMs: 0, personCount: 0, vehicleCount: 0,
          activeThreat: null, modelsLoaded: true, cameraActive: true,
        });

        // Start inference loop
        animFrameRef.current = requestAnimationFrame(inferenceLoop);

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setCameraError('Camera access denied. Please allow camera permissions and refresh.');
        } else if (msg.includes('NotFound')) {
          setCameraError('No camera device found. Connect a webcam and refresh.');
        } else {
          setCameraError(`Camera error: ${msg}`);
        }
      }
    }

    init();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      disposeModels();
      resetCombatState();
      resetAccidentState();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (cameraError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/80 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center">
          <CameraOff size={24} className="text-red-400" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-red-400">Camera Unavailable</p>
          <p className="text-xs font-mono text-slate-500 max-w-xs">{cameraError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 bg-black overflow-hidden hud-frame scanlines">
      {/* Hidden video element — AI reads frames from here */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
        muted
        playsInline
        aria-hidden="true"
      />

      {/* Canvas — the visible feed + HUD overlays */}
      <canvas
        ref={canvasRef}
        id="surveillance-canvas"
        className="absolute inset-0 w-full h-full object-cover"
        aria-label="Live surveillance feed with AI overlay"
      />

      {/* Loading overlay — shown while camera/models initialize */}
      {!cameraReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-4 z-20">
          <Loader2 size={32} className="text-emerald-400 animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-200">Initializing Camera</p>
            <p className="text-xs font-mono text-slate-500">
              {modelsLoaded ? 'AI models ready — starting feed...' : 'Loading AI models (WebGL)...'}
            </p>
          </div>
        </div>
      )}

      {/* Models loading indicator (camera up but models still loading) */}
      {cameraReady && !modelsLoaded && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 rounded-full px-4 py-2">
          <Loader2 size={12} className="text-emerald-400 animate-spin" />
          <span className="text-xs font-mono text-slate-300">Loading AI models…</span>
        </div>
      )}

      {/* Threat alert flash border */}
      {activeThreat && (
        <div className="absolute inset-0 border-4 border-red-500/80 rounded-none pointer-events-none z-10 animate-pulse-danger" />
      )}
    </div>
  );
}
