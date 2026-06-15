export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface EncryptResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}

export interface ICrypto {
  generateDHKeyPair(): KeyPair;
  generateSigningKeyPair(): KeyPair;

  encrypt(plaintext: Uint8Array, recipientPublicKey: Uint8Array, senderPrivateKey: Uint8Array): EncryptResult;
  decrypt(ciphertext: Uint8Array, nonce: Uint8Array, ephemeralPublicKey: Uint8Array, recipientPrivateKey: Uint8Array): Uint8Array;

  sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;

  randomBytes(n: number): Uint8Array;
  deviceIdFromPublicKey(publicKey: Uint8Array): string;
}
