import { encode, decode } from '@msgpack/msgpack';
import type { Envelope } from '@offchat/domain';

export function serializeEnvelope(env: Envelope): Uint8Array {
  return encode({
    i:   env.envelopeId,
    v:   env.protocolVersion,
    t:   env.timestampUtc,
    sd:  env.senderDeviceId,
    sn:  env.senderNickname,
    rd:  env.recipientDeviceId,
    cs:  env.chatScope,
    ri:  env.roomId,
    mt:  env.messageType,
    pl:  env.payload,
    th:  env.ttlHops,
    sig: env.signature,
    em: {
      alg: env.encryptionMetadata.algorithm,
      n:   env.encryptionMetadata.nonce,
      epk: env.encryptionMetadata.ephemeralPublicKey,
    },
  });
}

export function deserializeEnvelope(data: Uint8Array): Envelope {
  const raw = decode(data) as Record<string, unknown>;
  const em  = raw['em'] as Record<string, unknown>;

  return {
    envelopeId:        raw['i']  as string,
    protocolVersion:   raw['v']  as number,
    timestampUtc:      raw['t']  as number,
    senderDeviceId:    raw['sd'] as string,
    senderNickname:    raw['sn'] as string,
    recipientDeviceId: (raw['rd'] as string | undefined) ?? '',
    chatScope:         raw['cs'] as 'dm' | 'room',
    roomId:            raw['ri'] as string | null,
    messageType:       raw['mt'] as Envelope['messageType'],
    payload:           raw['pl'] as Uint8Array,
    ttlHops:           raw['th'] as number,
    signature:         raw['sig'] as Uint8Array,
    encryptionMetadata: {
      algorithm:          em['alg'] as 'chacha20-poly1305',
      nonce:              em['n']   as Uint8Array,
      ephemeralPublicKey: em['epk'] as Uint8Array,
    },
  };
}
