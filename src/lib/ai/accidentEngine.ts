/**
 * accidentEngine.ts — Vehicle Collision Detection
 *
 * Works for both live outdoor CCTV footage AND secondary-screen playback
 * (e.g., a crash video played on a mobile phone held in front of the webcam).
 *
 * Detection strategy — 3-phase state machine per vehicle pair:
 *
 *   PHASE 1 — APPROACH:
 *     Track pairwise IoU (Intersection over Union) for all combinations of
 *     vehicle bounding boxes (car, truck, bus, motorcycle).
 *     Record per-pair velocity: rate of bounding-box centroid approach.
 *
 *   PHASE 2 — IMPACT:
 *     Detect sudden velocity collapse:
 *       • Pre-impact approach velocity > 0 (boxes were converging)
 *       • IoU ≥ IoU_OVERLAP_THRESHOLD (boxes now overlapping)
 *       • Centroid approach delta drops by ≥ VELOCITY_COLLAPSE_THRESHOLD
 *         within VELOCITY_COLLAPSE_WINDOW frames (rapid deceleration)
 *
 *   PHASE 3 — POST-IMPACT PERSISTENCE:
 *     The overlap must persist for ≥ POST_IMPACT_FRAMES consecutive frames
 *     to rule out fast-moving false positives (e.g. vehicles briefly crossing).
 *
 * All bounding box coordinates are assumed to be in the same pixel space as
 * the video frame (i.e., COCO-SSD output coordinates).
 */

import type { DetectionBox, AccidentDetectionResult } from '../types';

// ─────────────────────────────────────────────
// Tunable Constants
// ─────────────────────────────────────────────

/** IoU overlap threshold that initiates impact tracking */
const IoU_OVERLAP_THRESHOLD = 0.15;

/**
 * Centroid approach velocity must collapse by at least this fraction
 * relative to the previous frame velocity to count as impact deceleration.
 * e.g. 0.60 = velocity dropped 60% or more in one frame step.
 */
const VELOCITY_COLLAPSE_THRESHOLD = 0.60;

/** Number of frames over which velocity collapse is evaluated */
const VELOCITY_COLLAPSE_WINDOW = 3;

/** Frames of sustained overlap required to confirm a crash (post-impact persistence) */
const POST_IMPACT_FRAMES = 12;

/** Minimum COCO-SSD confidence for a vehicle detection to be used */
const VEHICLE_CONFIDENCE_THRESHOLD = 0.40;

/** Vehicle COCO classes we track */
const VEHICLE_CLASSES = new Set(['car', 'truck', 'bus', 'motorcycle']);

// ─────────────────────────────────────────────
// Per-Pair State
// ─────────────────────────────────────────────

interface PairState {
  key: string;

  /** Ring buffer of recent centroid distances (newest last) */
  distanceHistory: number[];

  /** Ring buffer of recent IoU scores */
  iouHistory: number[];

  /** Consecutive frames with IoU ≥ threshold after velocity collapse */
  postImpactFrames: number;

  /** True once impact phase has been detected for this pair */
  impactDetected: boolean;

  /** Cached reference to the two boxes at time of detection */
  vehicleA: DetectionBox | null;
  vehicleB: DetectionBox | null;

  /** Highest confidence score seen during post-impact phase */
  peakConfidence: number;
}

const pairStates = new Map<string, PairState>();

// ─────────────────────────────────────────────
// Geometry Helpers
// ─────────────────────────────────────────────

function boxCenter(box: DetectionBox): { x: number; y: number } {
  return {
    x: box.bbox.x + box.bbox.width / 2,
    y: box.bbox.y + box.bbox.height / 2,
  };
}

function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Compute Intersection over Union for two bounding boxes.
 * Returns a value in [0, 1].
 */
function computeIoU(a: DetectionBox, b: DetectionBox): number {
  const ax1 = a.bbox.x;
  const ay1 = a.bbox.y;
  const ax2 = a.bbox.x + a.bbox.width;
  const ay2 = a.bbox.y + a.bbox.height;

  const bx1 = b.bbox.x;
  const by1 = b.bbox.y;
  const bx2 = b.bbox.x + b.bbox.width;
  const by2 = b.bbox.y + b.bbox.height;

  const interX1 = Math.max(ax1, bx1);
  const interY1 = Math.max(ay1, by1);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);

  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;

  if (interArea === 0) return 0;

  const aArea = a.bbox.width * a.bbox.height;
  const bArea = b.bbox.width * b.bbox.height;
  const unionArea = aArea + bArea - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Stable sort key for a pair to avoid duplicate A-B / B-A pairs.
 */
function pairKey(i: number, j: number): string {
  return `${Math.min(i, j)}-${Math.max(i, j)}`;
}

/** Get or create PairState for a given key */
function getOrCreateState(key: string): PairState {
  if (!pairStates.has(key)) {
    pairStates.set(key, {
      key,
      distanceHistory: [],
      iouHistory: [],
      postImpactFrames: 0,
      impactDetected: false,
      vehicleA: null,
      vehicleB: null,
      peakConfidence: 0,
    });
  }
  return pairStates.get(key)!;
}

/** Append a value to a ring buffer with a max length */
function ringPush(arr: number[], value: number, maxLen: number): void {
  arr.push(value);
  if (arr.length > maxLen) arr.shift();
}

// ─────────────────────────────────────────────
// Velocity Collapse Detection
// ─────────────────────────────────────────────

/**
 * Detect if the distance history shows a sudden velocity collapse.
 * Velocity collapse = rate of approach dropped by ≥ VELOCITY_COLLAPSE_THRESHOLD.
 *
 * Returns the collapse magnitude (0 if no collapse detected).
 */
function detectVelocityCollapse(distances: number[]): number {
  if (distances.length < VELOCITY_COLLAPSE_WINDOW + 1) return 0;

  // Compute per-frame deltas (negative = approaching)
  const deltas: number[] = [];
  for (let i = 1; i < distances.length; i++) {
    deltas.push(distances[i] - distances[i - 1]);
  }

  // Average velocity in the last VELOCITY_COLLAPSE_WINDOW frames vs one frame ago
  const recent = deltas.slice(-VELOCITY_COLLAPSE_WINDOW);
  const prevVelocity = deltas[deltas.length - VELOCITY_COLLAPSE_WINDOW - 1];
  const avgRecentVelocity =
    recent.reduce((s, v) => s + v, 0) / recent.length;

  // Approach was happening (prevVelocity < 0 = distance decreasing)
  if (prevVelocity >= 0) return 0;

  // Current velocity is much smaller in magnitude (collision absorbed motion)
  const collapse =
    (Math.abs(prevVelocity) - Math.abs(avgRecentVelocity)) /
    Math.abs(prevVelocity);

  return collapse >= VELOCITY_COLLAPSE_THRESHOLD ? collapse : 0;
}

// ─────────────────────────────────────────────
// Cleanup stale pairs (vehicles no longer detected)
// ─────────────────────────────────────────────

function pruneStaleStates(activeKeys: Set<string>): void {
  for (const key of Array.from(pairStates.keys())) {
    if (!activeKeys.has(key)) {
      const state = pairStates.get(key)!;
      // Reset post-impact counter but keep history for continuity if they reappear
      state.postImpactFrames = Math.max(0, state.postImpactFrames - 2);
      if (state.postImpactFrames === 0 && !state.impactDetected) {
        pairStates.delete(key);
      }
    }
  }
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Analyze a single frame of COCO-SSD detections for vehicle collision events.
 *
 * @param objects   All COCO-SSD DetectionBox results from the current frame
 * @returns AccidentDetectionResult — detected=false if no collision confirmed
 */
export function analyzeAccident(objects: DetectionBox[]): AccidentDetectionResult {
  // Filter to vehicle classes with sufficient confidence
  const vehicles = objects.filter(
    (obj) =>
      obj.score >= VEHICLE_CONFIDENCE_THRESHOLD &&
      VEHICLE_CLASSES.has(obj.class.toLowerCase())
  );

  if (vehicles.length < 2) {
    return { detected: false, confidence: 0 };
  }

  const activeKeys = new Set<string>();
  let bestResult: AccidentDetectionResult | null = null;

  // Evaluate all vehicle pairs
  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const vA = vehicles[i];
      const vB = vehicles[j];
      const key = pairKey(i, j);
      activeKeys.add(key);

      const state = getOrCreateState(key);

      const centA = boxCenter(vA);
      const centB = boxCenter(vB);
      const distance = dist2D(centA, centB);
      const iou = computeIoU(vA, vB);

      // Update history
      ringPush(state.distanceHistory, distance, VELOCITY_COLLAPSE_WINDOW + 2);
      ringPush(state.iouHistory, iou, POST_IMPACT_FRAMES + 2);

      // --- Phase 2: Impact detection ---
      if (!state.impactDetected && iou >= IoU_OVERLAP_THRESHOLD) {
        const collapse = detectVelocityCollapse(state.distanceHistory);
        if (collapse > 0) {
          state.impactDetected = true;
          state.vehicleA = vA;
          state.vehicleB = vB;
        }
      }

      // --- Phase 3: Post-impact persistence ---
      if (state.impactDetected) {
        if (iou >= IoU_OVERLAP_THRESHOLD) {
          state.postImpactFrames++;
        } else {
          // Allow brief loss of overlap (occlusion, detection gap)
          state.postImpactFrames = Math.max(0, state.postImpactFrames - 1);
        }

        if (state.postImpactFrames >= POST_IMPACT_FRAMES) {
          const avgIoU =
            state.iouHistory.slice(-POST_IMPACT_FRAMES).reduce((s, v) => s + v, 0) /
            POST_IMPACT_FRAMES;

          // Confidence: blend of IoU magnitude and detection scores
          const confidence = Math.min(
            (avgIoU / IoU_OVERLAP_THRESHOLD) * 0.4 +
              ((vA.score + vB.score) / 2) * 0.4 +
              Math.min(state.postImpactFrames / POST_IMPACT_FRAMES, 1) * 0.2,
            0.97
          );

          state.peakConfidence = Math.max(state.peakConfidence, confidence);

          const result: AccidentDetectionResult = {
            detected: true,
            confidence: state.peakConfidence,
            vehicleA: state.vehicleA ?? vA,
            vehicleB: state.vehicleB ?? vB,
            iouScore: avgIoU,
            velocityCollapse: undefined, // not easily recomputed here
          };

          if (!bestResult || confidence > (bestResult.confidence ?? 0)) {
            bestResult = result;
          }
        }
      }
    }
  }

  pruneStaleStates(activeKeys);

  return bestResult ?? { detected: false, confidence: 0 };
}

/**
 * Clear all vehicle pair tracking state.
 * Call when the camera stream stops or the component unmounts.
 */
export function resetAccidentState(): void {
  pairStates.clear();
}

/**
 * Return a snapshot of currently tracked vehicle pairs (for debug HUD).
 */
export function getTrackedPairs(): ReadonlyMap<string, Readonly<PairState>> {
  return pairStates;
}
