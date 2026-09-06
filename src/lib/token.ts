/**
 * token.ts — HMAC-SHA256 30-minute live viewer token generator & verifier
 *
 * Tokens are URL-safe base64 strings encoding a JSON payload:
 *   { incidentId: string, expiresAt: number (ms since epoch) }
 *
 * The payload is signed with HMAC-SHA256 using TOKEN_SECRET from .env.local.
 * Tokens cannot be forged or extended without the secret.
 *
 * Flow:
 *  1. POST /api/incidents → calls generateLiveToken(incidentId) → returns token
 *  2. Token embedded in email link: /live/[token]
 *  3. GET /api/live-token?token=... → calls verifyLiveToken(token) → valid/expired
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { LiveTokenPayload, LiveTokenVerification } from './types';

/** Token validity window in milliseconds (30 minutes) */
const TOKEN_TTL_MS = 30 * 60 * 1000;

/** Secret key for HMAC signing — must be set in environment */
function getSecret(): string {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      '[token.ts] TOKEN_SECRET environment variable is not set. ' +
        'Add TOKEN_SECRET=<random-secure-string> to your .env.local file.'
    );
  }
  return secret;
}

// ─────────────────────────────────────────────
// Encoding Helpers
// ─────────────────────────────────────────────

/** Encode a string to URL-safe base64 (no padding, no +/) */
function toBase64Url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

/** Decode a URL-safe base64 string back to a UTF-8 string */
function fromBase64Url(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8');
}

// ─────────────────────────────────────────────
// HMAC Signing
// ─────────────────────────────────────────────

/**
 * Produce an HMAC-SHA256 signature for the given payload string.
 * Returns URL-safe base64.
 */
function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generate a 30-minute HMAC-signed live viewer token for the given incident.
 *
 * Token format (dot-separated):
 *   <base64url(payload)>.<base64url(hmac_signature)>
 *
 * @param incidentId — UUID of the incident record
 * @returns URL-safe token string to embed in /live/[token] route
 */
export function generateLiveToken(incidentId: string): string {
  const payload: LiveTokenPayload = {
    incidentId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a live viewer token.
 *
 * Checks:
 *  1. Token has correct format (two dot-separated parts)
 *  2. HMAC signature is valid (timing-safe comparison)
 *  3. Token has not expired (Date.now() < expiresAt)
 *
 * @param token — Token string from the URL parameter
 * @returns LiveTokenVerification with valid flag, remainingSeconds, and incidentId
 */
export function verifyLiveToken(token: string): LiveTokenVerification {
  const INVALID: LiveTokenVerification = {
    valid: false,
    remainingSeconds: 0,
    incidentId: '',
  };

  try {
    // 1. Parse structure
    const parts = token.split('.');
    if (parts.length !== 2) return INVALID;

    const [encodedPayload, providedSignature] = parts;

    // 2. Recompute expected signature and compare in constant time
    const expectedSignature = sign(encodedPayload);

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const providedBuf = Buffer.from(providedSignature, 'utf8');

    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return INVALID;
    }

    // 3. Decode and parse payload
    const payload: LiveTokenPayload = JSON.parse(fromBase64Url(encodedPayload));

    if (!payload.incidentId || !payload.expiresAt) return INVALID;

    // 4. Check expiry
    const remainingMs = payload.expiresAt - Date.now();

    if (remainingMs <= 0) {
      return { valid: false, remainingSeconds: 0, incidentId: payload.incidentId };
    }

    return {
      valid: true,
      remainingSeconds: Math.floor(remainingMs / 1000),
      incidentId: payload.incidentId,
    };
  } catch {
    return INVALID;
  }
}
