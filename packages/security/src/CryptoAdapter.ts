import { ed25519, x25519 } from '@noble/curves/ed25519';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { sha256 } from '@noble/hashes/sha2';
import { hkdf } from '@noble/hashes/hkdf';
import { randomBytes } from '@noble/ciphers/webcrypto';
import type { ICrypto, KeyPair, EncryptResult } from '@offchat/domain';

export class CryptoAdapter implements ICrypto {
  generateDHKeyPair(): KeyPair {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
  }

  generateSigningKeyPair(): KeyPair {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
  }

  encrypt(plaintext: Uint8Array, recipientPublicKey: Uint8Array, senderPrivateKey: Uint8Array): EncryptResult {
    const ephemeralPrivate = x25519.utils.randomPrivateKey();
    const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivate);
    const rawShared = x25519.getSharedSecret(ephemeralPrivate, recipientPublicKey);

    const key = hkdf(sha256, rawShared, ephemeralPublicKey, 'offchat-v1-msg', 32);
    const nonce = this.randomBytes(12);
    const cipher = chacha20poly1305(key, nonce);
    const ciphertext = cipher.encrypt(plaintext);

    return { ciphertext, nonce, ephemeralPublicKey };
  }

  decrypt(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    ephemeralPublicKey: Uint8Array,
    recipientPrivateKey: Uint8Array,
  ): Uint8Array {
    const rawShared = x25519.getSharedSecret(recipientPrivateKey, ephemeralPublicKey);
    const key = hkdf(sha256, rawShared, ephemeralPublicKey, 'offchat-v1-msg', 32);
    const cipher = chacha20poly1305(key, nonce);
    return cipher.decrypt(ciphertext);
  }

  sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
    return ed25519.sign(message, privateKey);
  }

  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    try {
      return ed25519.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  }

  randomBytes(n: number): Uint8Array {
    return randomBytes(n);
  }

  deviceIdFromPublicKey(publicKey: Uint8Array): string {
    const hash = sha256(publicKey);
    return Array.from(hash.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
