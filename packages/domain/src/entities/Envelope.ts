export type ChatScope = 'dm' | 'room';
export type MessageType = 'text' | 'ack' | 'call-signal' | 'system';

export interface EncryptionMetadata {
  algorithm: 'chacha20-poly1305';
  nonce: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}

export interface Envelope {
  envelopeId: string;
  protocolVersion: number;
  timestampUtc: number;
  senderDeviceId: string;
  senderNickname: string;
  recipientDeviceId: string;
  chatScope: ChatScope;
  roomId: string | null;
  messageType: MessageType;
  payload: Uint8Array;
  ttlHops: number;
  signature: Uint8Array;
  encryptionMetadata: EncryptionMetadata;
}
