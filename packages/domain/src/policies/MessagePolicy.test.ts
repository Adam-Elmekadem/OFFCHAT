import { describe, it, expect } from 'vitest';
import { validateEnvelope, shouldRelay, decrementTtl, PROTOCOL_VERSION } from './MessagePolicy.js';
import type { Envelope } from '../entities/Envelope.js';

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    envelopeId: 'aabbccdd-eeff-7000-8000-112233445566',
    protocolVersion: PROTOCOL_VERSION,
    timestampUtc: Date.now(),
    senderDeviceId: 'device-a',
    senderNickname: 'alice',
    chatScope: 'dm',
    roomId: null,
    messageType: 'text',
    payload: new Uint8Array(10),
    ttlHops: 3,
    signature: new Uint8Array(64),
    encryptionMetadata: {
      algorithm: 'chacha20-poly1305',
      nonce: new Uint8Array(12),
      ephemeralPublicKey: new Uint8Array(32),
    },
    ...overrides,
  };
}

describe('validateEnvelope', () => {
  it('returns null for a valid envelope', () => {
    expect(validateEnvelope(makeEnvelope())).toBeNull();
  });

  it('rejects unsupported protocol version', () => {
    expect(validateEnvelope(makeEnvelope({ protocolVersion: 99 }))).toBe('unsupported_version');
  });

  it('rejects oversized payloads', () => {
    expect(validateEnvelope(makeEnvelope({ payload: new Uint8Array(70_000) }))).toBe('payload_too_large');
  });

  it('rejects ttl out of range', () => {
    expect(validateEnvelope(makeEnvelope({ ttlHops: 8 }))).toBe('ttl_out_of_range');
    expect(validateEnvelope(makeEnvelope({ ttlHops: -1 }))).toBe('ttl_out_of_range');
  });

  it('rejects clock skew beyond 5 minutes', () => {
    const old = Date.now() - 6 * 60 * 1000;
    expect(validateEnvelope(makeEnvelope({ timestampUtc: old }))).toBe('clock_skew_exceeded');
  });
});

describe('shouldRelay', () => {
  it('returns true when ttlHops > 0', () => {
    expect(shouldRelay(makeEnvelope({ ttlHops: 1 }))).toBe(true);
  });

  it('returns false when ttlHops is 0', () => {
    expect(shouldRelay(makeEnvelope({ ttlHops: 0 }))).toBe(false);
  });
});

describe('decrementTtl', () => {
  it('reduces ttlHops by 1', () => {
    const env = makeEnvelope({ ttlHops: 3 });
    expect(decrementTtl(env).ttlHops).toBe(2);
  });
});
