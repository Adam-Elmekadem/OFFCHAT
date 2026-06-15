import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Identity } from '@offchat/domain';

interface SerializedIdentity {
  id: string;
  nickname: string;
  publicKey: string;
  privateKey: string;
  signingPublicKey: string;
  signingPrivateKey: string;
  createdAt: number;
}

export class KeyStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Identity | null> {
    if (!existsSync(this.filePath)) return null;
    const raw = await readFile(this.filePath, 'utf8');
    const s: SerializedIdentity = JSON.parse(raw) as SerializedIdentity;
    return {
      id: s.id,
      nickname: s.nickname,
      publicKey: Buffer.from(s.publicKey, 'hex'),
      privateKey: Buffer.from(s.privateKey, 'hex'),
      signingPublicKey: Buffer.from(s.signingPublicKey, 'hex'),
      signingPrivateKey: Buffer.from(s.signingPrivateKey, 'hex'),
      createdAt: s.createdAt,
    };
  }

  async save(identity: Identity): Promise<void> {
    const s: SerializedIdentity = {
      id: identity.id,
      nickname: identity.nickname,
      publicKey: Buffer.from(identity.publicKey).toString('hex'),
      privateKey: Buffer.from(identity.privateKey).toString('hex'),
      signingPublicKey: Buffer.from(identity.signingPublicKey).toString('hex'),
      signingPrivateKey: Buffer.from(identity.signingPrivateKey).toString('hex'),
      createdAt: identity.createdAt,
    };
    await writeFile(this.filePath, JSON.stringify(s, null, 2), { mode: 0o600 });
  }
}
