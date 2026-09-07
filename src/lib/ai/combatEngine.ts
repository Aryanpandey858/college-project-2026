/**
 * combatEngine.ts — Hand-to-Hand Combat & Brawl Detection
 *
 * Detection strategy (two independent triggers — either can fire):
 *
 * TRIGGER A — Strike velocity vector:
 *   1. Track each person's left and right wrist positions across consecutive frames.
 *   2. Compute wrist displacement magnitude per Δt (normalized to torso height).
 *   3. If ||v_wrist|| > STRIKE_VELOCITY_THRESHOLD (torso-heights / sec):
 *      a. Compute dot product of wrist velocity vector with direction from
 *         wrist → nearest other person's head/torso centroid.
 *      b. If dot product > DIRECTION_ALIGNMENT_THRESHOLD → STRIKE DETECTED.
 *
 * TRIGGER B — Grappling / clinch:
 *   1. Compute centroid distance between each pair of detected persons.
 *   2. If distance < CLINCH_DISTANCE_FACTOR × avg_torso_height for ≥ CLINCH_MIN_FRAMES
 *      consecutive frames → CLINCH DETECTED.
 *
 * All thresholds are in normalized frame-height units unless stated otherwise.
 */

import type {
  DetectedPerson,
  PoseKeypoint,
  CombatDetectionResult,
} from '../types';

// ─────────────────────────────────────────────
// Tunable Constants
// ─────────────────────────────────────────────

/** Minimum wrist velocity to trigger a strike (torso-heights per second) */
const STRIKE_VELOCITY_THRESHOLD = 1.2;

/** Dot-product alignment required: velocity must point ≥70% toward victim */
const DIRECTION_ALIGNMENT_THRESHOLD = 0.70;

/** Minimum confidence for a keypoint to be considered valid */
const KEYPOINT_CONFIDENCE_THRESHOLD = 0.25;

/** Person's torso proximity factor for grappling clinch (× avg torso height) */
const CLINCH_DISTANCE_FACTOR = 0.8;

/** Number of consecutive frames both persons must be close for a clinch alert */
const CLINCH_MIN_FRAMES = 4;

/** Minimum per-person detection confidence to include them in analysis */
const PERSON_CONFIDENCE_THRESHOLD = 0.15;

// ─────────────────────────────────────────────
// Per-Person Frame State (stored between frames)
// ─────────────────────────────────────────────

interface WristHistory {
  /** Tracker ID (from MoveNet) */
  personId: number;
  lWrist: { x: number; y: number; t: number } | null;
  rWrist: { x: number; y: number; t: number } | null;
}

interface ClinchState {
  /** Pair key: `${idA}-${idB}` sorted */
  key: string;
  /** Consecutive frames below clinch distance */
  frames: number;
}

// Module-level state (persists across analyze() calls)
const wristHistories = new Map<number, WristHistory>();
const clinchStates = new Map<string, ClinchState>();

// ─────────────────────────────────────────────
// Keypoint Helpers
// ─────────────────────────────────────────────

/**
 * MoveNet keypoint indices (0-indexed, COCO order).
 */
const KP = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

function getKP(person: DetectedPerson, idx: number): PoseKeypoint | null {
  const kp = person.keypoints[idx];
  return kp && kp.score >= KEYPOINT_CONFIDENCE_THRESHOLD ? kp : null;
}

/** Euclidean distance between two 2-D points */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Dot product of two 2-D vectors */
function dot(
  v1: { x: number; y: number },
  v2: { x: number; y: number }
): number {
  return v1.x * v2.x + v1.y * v2.y;
}

/** Normalize a 2-D vector (returns zero vector if magnitude ≈ 0) */
function normalize(v: { x: number; y: number }): { x: number; y: number } {
  const mag = Math.sqrt(v.x ** 2 + v.y ** 2);
  if (mag < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

/**
 * Estimate a person's torso height in frame-normalized units.
 * Uses shoulder midpoint → hip midpoint distance.
 */
function getTorsoHeight(person: DetectedPerson): number {
  const lShoulder = getKP(person, KP.LEFT_SHOULDER);
  const rShoulder = getKP(person, KP.RIGHT_SHOULDER);
  const lHip = getKP(person, KP.LEFT_HIP);
  const rHip = getKP(person, KP.RIGHT_HIP);

  if (!lShoulder || !rShoulder || !lHip || !rHip) return 0.2; // fallback

  const shoulderMid = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
  };
  const hipMid = {
    x: (lHip.x + rHip.x) / 2,
    y: (lHip.y + rHip.y) / 2,
  };
  return Math.max(dist(shoulderMid, hipMid), 0.05);
}

/**
 * Estimate a person's body centroid (mid-shoulder to mid-hip midpoint).
 */
function getCentroid(person: DetectedPerson): { x: number; y: number } | null {
  const lShoulder = getKP(person, KP.LEFT_SHOULDER);
  const rShoulder = getKP(person, KP.RIGHT_SHOULDER);
  const lHip = getKP(person, KP.LEFT_HIP);
  const rHip = getKP(person, KP.RIGHT_HIP);

  if (!lShoulder && !rShoulder) return null;

  const sx = ((lShoulder?.x ?? 0) + (rShoulder?.x ?? 0)) / 2;
  const sy = ((lShoulder?.y ?? 0) + (rShoulder?.y ?? 0)) / 2;
  const hx = ((lHip?.x ?? sx) + (rHip?.x ?? sx)) / 2;
  const hy = ((lHip?.y ?? sy) + (rHip?.y ?? sy)) / 2;

  return { x: (sx + hx) / 2, y: (sy + hy) / 2 };
}

// ─────────────────────────────────────────────
// Strike Detection
// ─────────────────────────────────────────────

/**
 * Analyze wrist velocity for one person against all other persons.
 * Returns a CombatDetectionResult if a strike is detected.
 */
function analyzeStrike(
  attacker: DetectedPerson,
  others: DetectedPerson[],
  frameTimeMs: number
): CombatDetectionResult | null {
  const attackerId = attacker.id ?? -1;
  if (attackerId === -1) return null;

  const torsoH = getTorsoHeight(attacker);

  for (const side of ['left', 'right'] as const) {
    const kpIdx = side === 'left' ? KP.LEFT_WRIST : KP.RIGHT_WRIST;
    const wristKP = getKP(attacker, kpIdx);
    if (!wristKP) continue;

    const currentWrist = { x: wristKP.x, y: wristKP.y, t: frameTimeMs };

    // Fetch or init wrist history
    let history = wristHistories.get(attackerId);
    if (!history) {
      history = { personId: attackerId, lWrist: null, rWrist: null };
      wristHistories.set(attackerId, history);
    }

    const prevWrist = side === 'left' ? history.lWrist : history.rWrist;

    // Update history
    if (side === 'left') history.lWrist = currentWrist;
    else history.rWrist = currentWrist;

    if (!prevWrist) continue;

    const dt = (frameTimeMs - prevWrist.t) / 1000; // seconds
    if (dt <= 0 || dt > 0.5) continue; // stale frame

    const dx = currentWrist.x - prevWrist.x;
    const dy = currentWrist.y - prevWrist.y;
    const displacement = Math.sqrt(dx ** 2 + dy ** 2);

    // Velocity in torso-heights per second
    const velocity = displacement / torsoH / dt;

    if (velocity < STRIKE_VELOCITY_THRESHOLD) continue;

    // Wrist velocity direction (normalized)
    const velDir = normalize({ x: dx, y: dy });

    // Check alignment against each potential victim
    for (const victim of others) {
      if (victim.id === attackerId) continue;

      const victimCentroid = getCentroid(victim);
      if (!victimCentroid) continue;

      // Direction from attacker wrist → victim centroid
      const toVictim = normalize({
        x: victimCentroid.x - currentWrist.x,
        y: victimCentroid.y - currentWrist.y,
      });

      const alignment = dot(velDir, toVictim);

      if (alignment >= DIRECTION_ALIGNMENT_THRESHOLD) {
        const distance = dist({ x: currentWrist.x, y: currentWrist.y }, victimCentroid);
        // Confidence: blend of velocity excess and alignment
        const confidence = Math.min(
          ((velocity - STRIKE_VELOCITY_THRESHOLD) / 2 + (alignment - 0.7) * 2) * 0.6 + 0.4,
          0.99
        );

        return {
          detected: true,
          confidence,
          strikeOrigin: { x: currentWrist.x, y: currentWrist.y },
          strikeTarget: victimCentroid,
          wristVelocity: velocity,
          clinchDetected: false,
        };
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// Clinch / Grappling Detection
// ─────────────────────────────────────────────

function analyzeClinch(persons: DetectedPerson[]): CombatDetectionResult | null {
  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const a = persons[i];
      const b = persons[j];

      const centA = getCentroid(a);
      const centB = getCentroid(b);
      if (!centA || !centB) continue;

      const torsoAvg = (getTorsoHeight(a) + getTorsoHeight(b)) / 2;
      const proximity = dist(centA, centB);

      const idA = Math.min(a.id ?? i, b.id ?? j);
      const idB = Math.max(a.id ?? i, b.id ?? j);
      const key = `${idA}-${idB}`;

      let state = clinchStates.get(key);
      if (!state) {
        state = { key, frames: 0 };
        clinchStates.set(key, state);
      }

      if (proximity < CLINCH_DISTANCE_FACTOR * torsoAvg) {
        state.frames++;
      } else {
        state.frames = Math.max(0, state.frames - 1);
      }

      if (state.frames >= CLINCH_MIN_FRAMES) {
        const overlapRatio = 1 - proximity / (CLINCH_DISTANCE_FACTOR * torsoAvg);
        const confidence = Math.min(0.5 + overlapRatio * 0.5, 0.97);
        return {
          detected: true,
          confidence,
          strikeOrigin: centA,
          strikeTarget: centB,
          wristVelocity: 0,
          clinchDetected: true,
        };
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Analyze a single frame of pose detections for combat / brawl events.
 *
 * @param persons  — Array of DetectedPerson from MoveNet MultiPose
 * @param frameTimeMs — Current frame timestamp (e.g. Date.now())
 * @returns CombatDetectionResult — detected=false if no threat found
 */
export function analyzeCombat(
  persons: DetectedPerson[],
  frameTimeMs: number
): CombatDetectionResult {
  const qualified = persons.filter(
    (p) => p.score >= PERSON_CONFIDENCE_THRESHOLD && p.keypoints.length >= 13
  );

  if (qualified.length < 2) {
    return { detected: false, confidence: 0 };
  }

  // Trigger A: Strike velocity
  for (const attacker of qualified) {
    const others = qualified.filter((p) => p !== attacker);
    const result = analyzeStrike(attacker, others, frameTimeMs);
    if (result) return result;
  }

  // Trigger B: Grappling clinch
  const clinchResult = analyzeClinch(qualified);
  if (clinchResult) return clinchResult;

  return { detected: false, confidence: 0 };
}

/**
 * Clear all per-person wrist history and clinch state.
 * Call when the camera stream stops or component unmounts.
 */
export function resetCombatState(): void {
  wristHistories.clear();
  clinchStates.clear();
}
