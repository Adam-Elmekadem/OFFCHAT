export interface Identity {
  id: string;
  nickname: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  signingPublicKey: Uint8Array;
  signingPrivateKey: Uint8Array;
  createdAt: number;
}
