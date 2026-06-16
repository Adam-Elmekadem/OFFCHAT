import type { ICrypto, IStorage, Envelope, Identity, PeerInfo } from '@offchat/domain';
import { validateEnvelope } from '@offchat/domain';
import type { MessageDeduplicator } from '../services/MessageDeduplicator.js';

export interface DecodedMessage {
  envelope: Envelope;
  text: string;
  from: PeerInfo;
}

export type MessageHandler = (msg: DecodedMessage) => void;

export class ReceiveMessage {
  private readonly handlers: MessageHandler[] = [];

  constructor(
    private readonly crypto: ICrypto,
    private readonly storage: IStorage,
    private readonly deduplicator: MessageDeduplicator,
    private readonly identity: Identity,
  ) {}

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async handle(envelope: Envelope, from: PeerInfo): Promise<void> {
    const validationError = validateEnvelope(envelope);
    if (validationError) throw new Error(`envelope invalid: ${validationError}`);

    if (this.deduplicator.isDuplicate(envelope.envelopeId)) return;
    this.deduplicator.markSeen(envelope.envelopeId);

    if (await this.storage.envelopeExists(envelope.envelopeId)) return;
    await this.storage.saveEnvelope(envelope);

    if (envelope.messageType !== 'text') return;

    const plaintext = this.crypto.decrypt(
      envelope.payload,
      envelope.encryptionMetadata.nonce,
      envelope.encryptionMetadata.ephemeralPublicKey,
      this.identity.privateKey,
    );

    const text = new TextDecoder().decode(plaintext);
    const decoded: DecodedMessage = { envelope, text, from };
    for (const h of this.handlers) h(decoded);
  }
}
