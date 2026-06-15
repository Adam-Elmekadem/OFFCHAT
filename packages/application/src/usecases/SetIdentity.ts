import type { ICrypto, IStorage, Identity } from '@offchat/domain';
import { newId } from '@offchat/protocol';

export interface SetIdentityInput {
  nickname: string;
}

export class SetIdentity {
  constructor(
    private readonly crypto: ICrypto,
    private readonly storage: IStorage,
  ) {}

  async execute(input: SetIdentityInput): Promise<Identity> {
    const existing = await this.storage.getIdentity();
    if (existing) {
      const updated: Identity = { ...existing, nickname: input.nickname };
      await this.storage.saveIdentity(updated);
      return updated;
    }

    const dhKeys = this.crypto.generateDHKeyPair();
    const sigKeys = this.crypto.generateSigningKeyPair();

    const identity: Identity = {
      id: this.crypto.deviceIdFromPublicKey(dhKeys.publicKey),
      nickname: input.nickname,
      publicKey: dhKeys.publicKey,
      privateKey: dhKeys.privateKey,
      signingPublicKey: sigKeys.publicKey,
      signingPrivateKey: sigKeys.privateKey,
      createdAt: Date.now(),
    };

    await this.storage.saveIdentity(identity);
    return identity;
  }

  async load(): Promise<Identity | null> {
    return this.storage.getIdentity();
  }
}
