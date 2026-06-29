import type { ICrypto, IStorage, Envelope, Identity, PeerInfo } from '@offchat/domain';
import { validateEnvelope } from '@offchat/domain';
import type { MessageDeduplicator } from '../services/MessageDeduplicator.js';

export interface DecodedMessage {
  envelope: Envelope;
  text: string;
  from: PeerInfo;
}

export type MessageHandler    = (msg: DecodedMessage) => void;
export type AckHandler        = (ackedEnvelopeId: string) => void;
export type CallSignalHandler = (payload: unknown, from: PeerInfo) => void;

export class ReceiveMessage {
  private readonly textHandlers:       MessageHandler[]    = [];
  private readonly ackHandlers:        AckHandler[]        = [];
  private readonly callSignalHandlers: CallSignalHandler[] = [];

  constructor(
    private readonly crypto: ICrypto,
    private readonly storage: IStorage,
    private readonly deduplicator: MessageDeduplicator,
    private readonly identity: Identity,
  ) {}

  onMessage(handler: MessageHandler): void       { this.textHandlers.push(handler); }
  onAck(handler: AckHandler): void               { this.ackHandlers.push(handler); }
  onCallSignal(handler: CallSignalHandler): void { this.callSignalHandlers.push(handler); }

  async handle(envelope: Envelope, from: PeerInfo): Promise<void> {
    const validationError = validateEnvelope(envelope);
    if (validationError) throw new Error(`envelope invalid: ${validationError}`);

    if (this.deduplicator.isDuplicate(envelope.envelopeId)) return;
    this.deduplicator.markSeen(envelope.envelopeId);

    const plaintext = this.crypto.decrypt(
      envelope.payload,
      envelope.encryptionMetadata.nonce,
      envelope.encryptionMetadata.ephemeralPublicKey,
      this.identity.privateKey,
    );
    const text = new TextDecoder().decode(plaintext);

    if (envelope.messageType === 'ack') {
      for (const h of this.ackHandlers) h(text);
      return;
    }

    if (envelope.messageType === 'call-signal') {
      try {
        const parsed: unknown = JSON.parse(text);
        for (const h of this.callSignalHandlers) h(parsed, from);
      } catch { /* malformed signal, discard */ }
      return;
    }

    if (envelope.messageType !== 'text') return;

    if (await this.storage.envelopeExists(envelope.envelopeId)) return;
    await this.storage.saveEnvelope(envelope);

    const decoded: DecodedMessage = { envelope, text, from };
    for (const h of this.textHandlers) h(decoded);
  }
}
