import { CryptoAdapter } from '@offchat/security';
import { newId } from '@offchat/protocol';
import { PROTOCOL_VERSION } from '@offchat/domain';
import type { Identity, Envelope, Contact } from '@offchat/domain';

const crypto = new CryptoAdapter();

export function makeIdentity(nickname: string): Identity {
  const dh = crypto.generateDHKeyPair();
  const sig = crypto.generateSigningKeyPair();
  return {
    id: crypto.deviceIdFromPublicKey(dh.publicKey),
    nickname,
    publicKey: dh.publicKey,
    privateKey: dh.privateKey,
    signingPublicKey: sig.publicKey,
    signingPrivateKey: sig.privateKey,
    createdAt: Date.now(),
  };
}

export function makeContact(identity: Identity): Contact {
  return {
    deviceId: identity.id,
    nickname: identity.nickname,
    publicKey: identity.publicKey,
    signingPublicKey: identity.signingPublicKey,
    trustState: 'unverified',
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}

export function makeEnvelope(sender: Identity, text: string, recipient: Identity): Envelope {
  const plaintext = new TextEncoder().encode(text);
  const { ciphertext, nonce, ephemeralPublicKey } = crypto.encrypt(
    plaintext,
    recipient.publicKey,
    sender.privateKey,
  );
  return {
    envelopeId: newId(),
    protocolVersion: PROTOCOL_VERSION,
    timestampUtc: Date.now(),
    senderDeviceId: sender.id,
    senderNickname: sender.nickname,
    chatScope: 'dm',
    roomId: null,
    messageType: 'text',
    payload: ciphertext,
    ttlHops: 0,
    signature: crypto.sign(new TextEncoder().encode(text), sender.signingPrivateKey),
    encryptionMetadata: {
      algorithm: 'chacha20-poly1305',
      nonce,
      ephemeralPublicKey,
    },
  };
}
