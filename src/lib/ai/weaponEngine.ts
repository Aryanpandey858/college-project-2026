/**
 * weaponEngine.ts — Universal Handheld Threat Detection
 *
 * Detection strategy:
 *
 *   1. For each detected person, locate left and right wrist keypoints.
 *   2. Compute an adaptive "grip circle" around each wrist:
 *        R_grip = GRIP_RADIUS_FACTOR × torso_height
 *   3. Scan all non-person COCO-SSD bounding boxes for overlap with either grip circle.
 *   4. If an intersecting object is found, evaluate posture:
 *
 *      MODE A — Overhead / forward strike:
 *        • Wrist Y-coordinate is above the ear keypoint (wrist.y < ear.y in image coords).
 *        • Wrist velocity (if available) has a downward/forward component.
 *
 *      MODE B — Two-handed aimed brandish:
 *        • Both wrists are close together (< TWO_HAND_THRESHOLD × torso_height).
 *        • A rigid non-person object is found within the combined grip area.
 *        • Object extends outward from the body (object centroid is further from person
 *          centroid than the grip point).
 *
 *   5. If either mode is triggered → WEAPON / THREAT DETECTED.
 *
 * Notes:
 *  - Excludes common false-positive classes (chair, couch, bed, dining table, etc.)
 *  - Requires COCO-SSD alongside MoveNet poses (passed in together per frame)
 */

import type {
  DetectedPerson,
  DetectionBox,
  WeaponDetectionResult,
} from '../types';

// ─────────────────────────────────────────────
// Tunable Constants
// ─────────────────────────────────────────────

/**
 * Grip circle radius as a fraction of the person's torso height.
 * A larger value tolerates imprecise wrist localization.
 */
const GRIP_RADIUS_FACTOR = 0.25;

/**
 * Two-hand convergence threshold: both wrists must be within this fraction
 * of torso height to count as "two-handed grip".
 */
const TWO_HAND_THRESHOLD = 0.15;

/** Minimum COCO-SSD detection confidence to consider an object */
const OBJECT_CONFIDENCE_THRESHOLD = 0.40;

/** Minimum MoveNet keypoint confidence to use a keypoint */
const KEYPOINT_CONFIDENCE_THRESHOLD = 0.25;

/** Minimum person score to run weapon analysis */
const PERSON_CONFIDENCE_THRESHOLD = 0.15;

/**
 * COCO classes we EXCLUDE from weapon detection to avoid false positives.
 * These are large static objects that cannot be "held".
 */
const EXCLUDED_CLASSES = new Set([
  'person',
  'chair', 'couch', 'bed', 'dining table', 'desk',
  'toilet', 'door', 'window', 'wall', 'ceiling', 'floor',
  'tv', 'laptop', 'monitor', 'keyboard', 'mouse',
  'car', 'truck', 'bus', 'train', 'airplane', 'boat',
  'traffic light', 'fire hydrant', 'stop sign',
  'parking meter', 'bench',
]);

// ─────────────────────────────────────────────
// MoveNet Keypoint Indices
// ─────────────────────────────────────────────

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
} as const;

// ─────────────────────────────────────────────
// Geometry Helpers
// ─────────────────────────────────────────────

function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Center of a DetectionBox bounding box */
function boxCenter(box: DetectionBox): { x: number; y: number } {
  return {
    x: box.bbox.x + box.bbox.width / 2,
    y: box.bbox.y + box.bbox.height / 2,
  };
}

/**
 * Check if a circle (center + radius) overlaps a bounding box.
 * Finds the nearest point on the box to the circle center.
 */
function circleOverlapsBox(
  cx: number,
  cy: number,
  radius: number,
  box: DetectionBox
): boolean {
  const { x, y, width, height } = box.bbox;
  const nearestX = Math.max(x, Math.min(cx, x + width));
  const nearestY = Math.max(y, Math.min(cy, y + height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Get a keypoint if it meets the confidence threshold, else null.
 */
function getKP(
  person: DetectedPerson,
  idx: number
): { x: number; y: number; score: number } | null {
  const kp = person.keypoints[idx];
  return kp && kp.score >= KEYPOINT_CONFIDENCE_THRESHOLD ? kp : null;
}

/**
 * Compute torso height: shoulder midpoint → hip midpoint distance.
 * Falls back to 0.20 (normalized units) if keypoints missing.
 */
function getTorsoHeight(person: DetectedPerson): number {
  const lS = getKP(person, KP.LEFT_SHOULDER);
  const rS = getKP(person, KP.RIGHT_SHOULDER);
  const lH = getKP(person, KP.LEFT_HIP);
  const rH = getKP(person, KP.RIGHT_HIP);

  if (!lS && !rS) return 0.2;

  const smx = ((lS?.x ?? rS!.x) + (rS?.x ?? lS!.x)) / 2;
  const smy = ((lS?.y ?? rS!.y) + (rS?.y ?? lS!.y)) / 2;
  const hmx = ((lH?.x ?? smx) + (rH?.x ?? smx)) / 2;
  const hmy = ((lH?.y ?? smy) + (rH?.y ?? smy)) / 2;

  return Math.max(dist2D({ x: smx, y: smy }, { x: hmx, y: hmy }), 0.05);
}

/**
 * Get body centroid (avg of shoulder and hip midpoints).
 */
function getCentroid(person: DetectedPerson): { x: number; y: number } {
  const lS = getKP(person, KP.LEFT_SHOULDER);
  const rS = getKP(person, KP.RIGHT_SHOULDER);
  const lH = getKP(person, KP.LEFT_HIP);
  const rH = getKP(person, KP.RIGHT_HIP);

  const sx = ((lS?.x ?? 0) + (rS?.x ?? 0)) / (lS && rS ? 2 : 1);
  const sy = ((lS?.y ?? 0) + (rS?.y ?? 0)) / (lS && rS ? 2 : 1);
  const hx = ((lH?.x ?? sx) + (rH?.x ?? sx)) / (lH && rH ? 2 : 1);
  const hy = ((lH?.y ?? sy) + (rH?.y ?? sy)) / (lH && rH ? 2 : 1);

  return { x: (sx + hx) / 2, y: (sy + hy) / 2 };
}

// ─────────────────────────────────────────────
// Posture Analysis
// ─────────────────────────────────────────────

type PostureMode = 'OVERHEAD_STRIKE' | 'TWO_HANDED_AIM' | null;

/**
 * Determine whether the person's posture indicates a threat.
 *
 * @param person     Detected person with keypoints
 * @param wristPos   The wrist that's holding the object
 * @param torsoH     Torso height (normalized)
 * @param otherWrist The other wrist position (if available), for two-hand check
 */
function classifyPosture(
  person: DetectedPerson,
  wristPos: { x: number; y: number },
  torsoH: number,
  otherWrist: { x: number; y: number } | null
): PostureMode {
  // Mode A: Wrist raised above the ear → overhead strike posture
  const lEar = getKP(person, KP.LEFT_EAR);
  const rEar = getKP(person, KP.RIGHT_EAR);
  const earY = lEar && rEar
    ? (lEar.y + rEar.y) / 2
    : lEar?.y ?? rEar?.y ?? null;

  if (earY !== null && wristPos.y < earY) {
    return 'OVERHEAD_STRIKE';
  }

  // Mode B: Both wrists converged with object pointing outward
  if (otherWrist) {
    const handDist = dist2D(wristPos, otherWrist);
    if (handDist < TWO_HAND_THRESHOLD * torsoH) {
      return 'TWO_HANDED_AIM';
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Analyze a single frame for handheld weapon / threat detection.
 *
 * @param persons   Array of persons from MoveNet MultiPose
 * @param objects   Array of COCO-SSD DetectionBox results
 * @returns WeaponDetectionResult — detected=false if no threat found
 */
export function analyzeWeapon(
  persons: DetectedPerson[],
  objects: DetectionBox[]
): WeaponDetectionResult {
  // Filter out excluded classes and low-confidence detections
  const candidateObjects = objects.filter(
    (obj) =>
      obj.score >= OBJECT_CONFIDENCE_THRESHOLD &&
      !EXCLUDED_CLASSES.has(obj.class.toLowerCase())
  );

  if (candidateObjects.length === 0) {
    return { detected: false, confidence: 0 };
  }

  for (const person of persons) {
    if (person.score < PERSON_CONFIDENCE_THRESHOLD) continue;

    const torsoH = getTorsoHeight(person);
    const gripRadius = GRIP_RADIUS_FACTOR * torsoH;
    const bodyCentroid = getCentroid(person);

    const lWristKP = getKP(person, KP.LEFT_WRIST);
    const rWristKP = getKP(person, KP.RIGHT_WRIST);

    const wristCandidates: Array<{
      pos: { x: number; y: number };
      other: { x: number; y: number } | null;
    }> = [];

    if (lWristKP) wristCandidates.push({ pos: lWristKP, other: rWristKP ?? null });
    if (rWristKP) wristCandidates.push({ pos: rWristKP, other: lWristKP ?? null });

    for (const { pos: wristPos, other: otherWrist } of wristCandidates) {
      for (const obj of candidateObjects) {
        // Check grip circle overlap with object bounding box
        if (!circleOverlapsBox(wristPos.x, wristPos.y, gripRadius, obj)) continue;

        // Object centroid must be further from body than wrist (extends outward)
        const objCenter = boxCenter(obj);
        const objDist = dist2D(bodyCentroid, objCenter);
        const wristDist = dist2D(bodyCentroid, wristPos);
        const extendsOutward = objDist >= wristDist * 0.8;

        if (!extendsOutward) continue;

        // Classify posture
        const postureMode = classifyPosture(person, wristPos, torsoH, otherWrist);

        if (!postureMode) continue;

        // Compute confidence from object score + posture certainty
        const postureBonus = postureMode === 'TWO_HANDED_AIM' ? 0.15 : 0.05;
        const confidence = Math.min(obj.score * 0.7 + 0.25 + postureBonus, 0.97);

        return {
          detected: true,
          confidence,
          gripPoint: wristPos,
          heldObject: obj,
          postureMode,
        };
      }
    }
  }

  return { detected: false, confidence: 0 };
}
