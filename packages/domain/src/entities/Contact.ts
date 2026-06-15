export type TrustState = 'trusted' | 'unverified' | 'blocked';

export interface Contact {
  deviceId: string;
  nickname: string;
  publicKey: Uint8Array;
  signingPublicKey: Uint8Array;
  trustState: TrustState;
  firstSeenAt: number;
  lastSeenAt: number;
}
