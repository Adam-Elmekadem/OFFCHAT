import type { ICrypto, IStorage, ITransport, Identity, Envelope, MessageType } from '@offchat/domain';
import { PROTOCOL_VERSION } from '@offchat/domain';
import { newId } from '@offchat/protocol';
import type { TransportRouter } from '../services/TransportRouter.js';
import type { RetryQueue } from '../services/RetryQueue.js';

export interface SendMessageInput {
  text: string;
  recipientDeviceId: string;
  recipientPublicKey: Uint8Array;
  chatScope: 'dm' | 'room';
  roomId?: string;
  messageType?: MessageType;
  ttlHops?: number;
}

export class SendMessage {
  constructor(
    private readonly crypto: ICrypto,
    private readonly storage: IStorage,
    private readonly router: TransportRouter,
    private readonly identity: Identity,
    private readonly retryQueue?: RetryQueue,
  ) {}

  async execute(input: SendMessageInput): Promise<Envelope> {
    const plaintext = new TextEncoder().encode(input.text);
    const { ciphertext, nonce, ephemeralPublicKey } = this.crypto.encrypt(
      plaintext,
      input.recipientPublicKey,
      this.identity.privateKey,
    );

    const envelopeBytes = new TextEncoder().encode(
      JSON.stringify({ id: newId(), ts: Date.now() }),
    );
    const signature = this.crypto.sign(envelopeBytes, this.identity.signingPrivateKey);

    const msgType = input.messageType ?? 'text';
    const envelope: Envelope = {
      envelopeId:        newId(),
      protocolVersion:   PROTOCOL_VERSION,
      timestampUtc:      Date.now(),
      senderDeviceId:    this.identity.id,
      senderNickname:    this.identity.nickname,
      recipientDeviceId: input.recipientDeviceId,
      chatScope:         input.chatScope,
      roomId:            input.roomId ?? null,
      messageType:       msgType,
      payload:           ciphertext,
      ttlHops:           input.ttlHops ?? (msgType === 'text' ? 3 : 0),
      signature,
      encryptionMetadata: {
        algorithm: 'chacha20-poly1305',
        nonce,
        ephemeralPublicKey,
      },
    };

    await this.router.send(input.recipientDeviceId, envelope);

    if (msgType === 'text') {
      await this.storage.saveEnvelope(envelope);
      this.retryQueue?.add(envelope, input.recipientDeviceId, input.recipientPublicKey);
    }

    return envelope;
  }
}
