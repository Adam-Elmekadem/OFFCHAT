# Protocol v1 — Message Envelope Schema

Every message, regardless of transport, is serialized as a **MessagePack** binary.

## Canonical Envelope Fields

| Field | Key | Type | Notes |
|---|---|---|---|
| envelopeId | `i` | string | UUIDv7 — globally unique, used for dedup |
| protocolVersion | `v` | uint | Must be `1` |
| timestampUtc | `t` | uint64 | Unix ms from sender |
| senderDeviceId | `sd` | string | 16-char hex derived from sender public key |
| senderNickname | `sn` | string | Max 32 chars |
| chatScope | `cs` | string | `"dm"` or `"room"` |
| roomId | `ri` | string? | null for DMs |
| messageType | `mt` | string | `"text"`, `"file_meta"`, `"command_event"`, `"system"` |
| payload | `pl` | bytes | Encrypted with ChaCha20-Poly1305 |
| ttlHops | `th` | uint | 0 = no relay; max 7 |
| signature | `sig` | bytes | Ed25519 over canonical envelope bytes |
| encryptionMetadata | `em` | object | See below |

### encryptionMetadata fields

| Field | Key | Type |
|---|---|---|
| algorithm | `alg` | `"chacha20-poly1305"` |
| nonce | `n` | 12 bytes |
| ephemeralPublicKey | `epk` | 32 bytes (X25519) |

## Validation Rules

1. Reject envelopes with `protocolVersion != 1`
2. Reject payload > 64 KB
3. Reject `ttlHops` outside `[0, 7]`
4. Reject clock skew > 5 minutes
5. Reject duplicate `envelopeId` (dedup window: 10 minutes)

## Key Exchange (ECIES-style)

Sender generates an ephemeral X25519 key pair per message.  
Shared secret = X25519(sender_ephemeral_private, recipient_public).  
Session key = HKDF-SHA256(shared_secret, info="offchat-v1-msg", len=32).  
Ciphertext = ChaCha20-Poly1305(key, nonce, plaintext).
