/**
 * types.ts — Shared TypeScript definitions & domain interfaces
 * All AI inference primitives, incident records, and API payloads are defined here.
 */

// ─────────────────────────────────────────────
// 1. Threat Classification
// ─────────────────────────────────────────────

/** Enum-like union of all supported threat types */
export type ThreatType = 'COMBAT' | 'WEAPON' | 'ACCIDENT' | 'CUSTOM';

// ─────────────────────────────────────────────
// 2. AI Inference Primitives
// ─────────────────────────────────────────────

/** A single pose keypoint as returned by MoveNet */
export interface PoseKeypoint {
  /** Keypoint name (e.g., 'left_wrist', 'right_shoulder') */
  name: string;
  /** Normalized x position (0–1 relative to frame width) */
  x: number;
  /** Normalized y position (0–1 relative to frame height) */
  y: number;
  /** Detection confidence score (0–1) */
  score: number;
}

/** A detected person with all 17 MoveNet keypoints */
export interface DetectedPerson {
  /** Person's overall detection confidence */
  score: number;
  /** Array of 17 keypoints in MoveNet order */
  keypoints: PoseKeypoint[];
  /** Unique tracker ID assigned across frames (for velocity computation) */
  id?: number;
}

/** An object detection bounding box (e.g., from COCO-SSD) */
export interface DetectionBox {
  /** Object class label (e.g., 'car', 'person', 'bottle') */
  class: string;
  /** Detection confidence (0–1) */
  score: number;
  /** Bounding box in pixel coordinates */
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ─────────────────────────────────────────────
// 3. Per-Frame Detection Results
// ─────────────────────────────────────────────

/** Result returned by combatEngine per analysis frame */
export interface CombatDetectionResult {
  detected: boolean;
  confidence: number;
  /** Attacker wrist position at moment of detection */
  strikeOrigin?: { x: number; y: number };
  /** Target torso centroid */
  strikeTarget?: { x: number; y: number };
  /** Wrist velocity magnitude in (torso-heights / second) */
  wristVelocity?: number;
  /** Whether grappling clinch was detected */
  clinchDetected?: boolean;
}

/** Result returned by weaponEngine per analysis frame */
export interface WeaponDetectionResult {
  detected: boolean;
  confidence: number;
  /** Wrist keypoint where grip was detected */
  gripPoint?: { x: number; y: number };
  /** The intersecting object bounding box */
  heldObject?: DetectionBox;
  /** Posture mode that triggered detection */
  postureMode?: 'OVERHEAD_STRIKE' | 'TWO_HANDED_AIM';
}

/** Result returned by accidentEngine per analysis frame */
export interface AccidentDetectionResult {
  detected: boolean;
  confidence: number;
  /** The two vehicles involved in the collision */
  vehicleA?: DetectionBox;
  vehicleB?: DetectionBox;
  /** Computed IoU score at time of detection */
  iouScore?: number;
  /** Velocity collapse percentage (e.g., -0.72 = -72%) */
  velocityCollapse?: number;
}

/** Union of all engine result types */
export type DetectionResult =
  | CombatDetectionResult
  | WeaponDetectionResult
  | AccidentDetectionResult;

// ─────────────────────────────────────────────
// 4. Incident Database Record (Supabase Row)
// ─────────────────────────────────────────────

/** Full incident row as stored in PostgreSQL and returned by Supabase */
export interface IncidentRecord {
  id: string;
  type: ThreatType;
  title: string;
  description: string;
  /** Detection confidence at the time the incident was triggered (0–1) */
  confidence: number;
  /** Public Supabase Storage URL for the frozen evidence frame */
  snapshot_url: string;
  /** Email address of the alert recipient */
  recipient_email: string;
  /** HMAC-signed 30-minute live viewer token */
  live_token: string;
  /** Optional JSON metadata (bounding boxes, velocity, IoU, etc.) */
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─────────────────────────────────────────────
// 5. API Payload — POST /api/incidents
// ─────────────────────────────────────────────

/** Payload the browser client POSTs to /api/incidents when a threat is triggered */
export interface IncidentPayload {
  /** Threat classification */
  type: ThreatType;
  /** Short human-readable incident title */
  title: string;
  /** Longer description including heuristic details */
  description: string;
  /** Detection confidence (0–1) */
  confidence: number;
  /** Base64-encoded JPEG/PNG evidence snapshot (without data: prefix) */
  snapshotBase64: string;
  /** MIME type of the snapshot (default: image/jpeg) */
  snapshotMimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Alert destination email address (from operator UI) */
  recipientEmail: string;
  /** Optional extra detection metadata to store in the DB */
  metadata?: Record<string, unknown>;
}

/** JSON response returned by POST /api/incidents on success */
export interface IncidentApiResponse {
  success: true;
  incidentId: string;
  snapshotUrl: string;
  liveViewerUrl: string;
  remainingSeconds: number;
}

/** JSON response returned on failure */
export interface IncidentApiError {
  success: false;
  error: string;
}

// ─────────────────────────────────────────────
// 6. Live Token Payload
// ─────────────────────────────────────────────

/** Decoded payload embedded inside the HMAC live viewer token */
export interface LiveTokenPayload {
  incidentId: string;
  /** Unix timestamp (ms) when the token expires */
  expiresAt: number;
}

/** Result of verifyLiveToken() */
export interface LiveTokenVerification {
  valid: boolean;
  remainingSeconds: number;
  incidentId: string;
}

// ─────────────────────────────────────────────
// 7. Supabase Realtime Broadcast Shape
// ─────────────────────────────────────────────

/** Payload structure broadcast over the Supabase realtime channel for live stream frames */
export interface StreamFramePayload {
  /** Base64-encoded JPEG preview frame (low-res, 5 FPS) */
  frameBase64: string;
  /** Server timestamp for synchronization */
  timestamp: number;
  /** Active threat type if currently alerting, null otherwise */
  activeThreat: ThreatType | null;
}
