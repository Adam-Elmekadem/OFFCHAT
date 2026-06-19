export type { Envelope, ChatScope, MessageType, EncryptionMetadata } from './entities/Envelope.js';
export type { Identity } from './entities/Identity.js';
export type { Contact, TrustState } from './entities/Contact.js';
export type { Room } from './entities/Room.js';
export type { Device, TransportType } from './entities/Device.js';

export type { ITransport, PeerInfo, PeerStatus } from './ports/ITransport.js';
export type { IStorage } from './ports/IStorage.js';
export type { ICrypto, KeyPair, EncryptResult } from './ports/ICrypto.js';

export {
  PROTOCOL_VERSION,
  MAX_PAYLOAD_BYTES,
  MAX_TTL_HOPS,
  validateEnvelope,
  shouldRelay,
  decrementTtl,
} from './policies/MessagePolicy.js';
export type { ValidationError } from './policies/MessagePolicy.js';
