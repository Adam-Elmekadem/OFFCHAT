import type { Envelope } from '../entities/Envelope.js';

export const PROTOCOL_VERSION = 1;
export const MAX_PAYLOAD_BYTES = 65_536;
export const MAX_TTL_HOPS = 7;
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type ValidationError =
  | 'unsupported_version'
  | 'missing_envelope_id'
  | 'payload_too_large'
  | 'ttl_out_of_range'
  | 'clock_skew_exceeded';

export function validateEnvelope(env: Envelope): ValidationError | null {
  if (env.protocolVersion !== PROTOCOL_VERSION) return 'unsupported_version';
  if (!env.envelopeId || env.envelopeId.length < 16) return 'missing_envelope_id';
  if (env.payload.byteLength > MAX_PAYLOAD_BYTES) return 'payload_too_large';
  if (env.ttlHops < 0 || env.ttlHops > MAX_TTL_HOPS) return 'ttl_out_of_range';
  if (Math.abs(Date.now() - env.timestampUtc) > MAX_CLOCK_SKEW_MS) return 'clock_skew_exceeded';
  return null;
}

export function shouldRelay(env: Envelope): boolean {
  return env.ttlHops > 0;
}

export function decrementTtl(env: Envelope): Envelope {
  return { ...env, ttlHops: env.ttlHops - 1 };
}
