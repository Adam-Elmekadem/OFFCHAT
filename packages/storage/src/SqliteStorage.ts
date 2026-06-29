import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { IStorage, Identity, Contact, Room, Envelope } from '@offchat/domain';

type StoredBytes = string;

interface StoredIdentity {
  id: string;
  nickname: string;
  publicKey: StoredBytes;
  privateKey: StoredBytes;
  signingPublicKey: StoredBytes;
  signingPrivateKey: StoredBytes;
  createdAt: number;
}

interface StoredContact {
  deviceId: string;
  nickname: string;
  publicKey: StoredBytes;
  signingPublicKey: StoredBytes;
  trustState: Contact['trustState'];
  firstSeenAt: number;
  lastSeenAt: number;
}

interface StoredEnvelope {
  envelopeId: string;
  protocolVersion: number;
  timestampUtc: number;
  senderDeviceId: string;
  senderNickname: string;
  chatScope: Envelope['chatScope'];
  roomId: string | null;
  messageType: Envelope['messageType'];
  payload: StoredBytes;
  ttlHops: number;
  signature: StoredBytes;
  encryptionMetadata: {
    algorithm: Envelope['encryptionMetadata']['algorithm'];
    nonce: StoredBytes;
    ephemeralPublicKey: StoredBytes;
  };
}

interface StoredRoom {
  id: string;
  name: string;
  createdAt: number;
  memberDeviceIds: string[];
}

interface StorageState {
  version: number;
  identity: StoredIdentity | null;
  envelopes: StoredEnvelope[];
  contacts: StoredContact[];
  rooms: StoredRoom[];
}

const DEFAULT_STATE: StorageState = {
  version: 1,
  identity: null,
  envelopes: [],
  contacts: [],
  rooms: [],
};

function bytesToBase64(bytes: Uint8Array): StoredBytes {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value: StoredBytes): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export class SqliteStorage implements IStorage {
  constructor(private readonly storagePath: string) {
    mkdirSync(dirname(storagePath), { recursive: true });
    this.ensureState();
  }

  private ensureState(): void {
    if (!existsSync(this.storagePath)) {
      this.persist(DEFAULT_STATE);
    }
  }

  private load(): StorageState {
    if (!existsSync(this.storagePath)) {
      return structuredClone(DEFAULT_STATE);
    }

    const raw = readFileSync(this.storagePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StorageState>;

    return {
      version: parsed.version ?? 1,
      identity: parsed.identity ?? null,
      envelopes: parsed.envelopes ?? [],
      contacts: parsed.contacts ?? [],
      rooms: parsed.rooms ?? [],
    };
  }

  private persist(state: StorageState): void {
    const tempPath = `${this.storagePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    writeFileSync(this.storagePath, readFileSync(tempPath));
  }

  private update(mutator: (state: StorageState) => void): void {
    const state = this.load();
    mutator(state);
    this.persist(state);
  }

  async getIdentity(): Promise<Identity | null> {
    const state = this.load();
    if (!state.identity) return null;

    return {
      id: state.identity.id,
      nickname: state.identity.nickname,
      publicKey: base64ToBytes(state.identity.publicKey),
      privateKey: base64ToBytes(state.identity.privateKey),
      signingPublicKey: base64ToBytes(state.identity.signingPublicKey),
      signingPrivateKey: base64ToBytes(state.identity.signingPrivateKey),
      createdAt: state.identity.createdAt,
    };
  }

  async saveIdentity(identity: Identity): Promise<void> {
    this.update(state => {
      state.identity = {
        id: identity.id,
        nickname: identity.nickname,
        publicKey: bytesToBase64(identity.publicKey),
        privateKey: bytesToBase64(identity.privateKey),
        signingPublicKey: bytesToBase64(identity.signingPublicKey),
        signingPrivateKey: bytesToBase64(identity.signingPrivateKey),
        createdAt: identity.createdAt,
      };
    });
  }

  async saveEnvelope(env: Envelope): Promise<void> {
    this.update(state => {
      if (state.envelopes.some(existing => existing.envelopeId === env.envelopeId)) {
        return;
      }

      state.envelopes.push({
        envelopeId: env.envelopeId,
        protocolVersion: env.protocolVersion,
        timestampUtc: env.timestampUtc,
        senderDeviceId: env.senderDeviceId,
        senderNickname: env.senderNickname,
        chatScope: env.chatScope,
        roomId: env.roomId,
        messageType: env.messageType,
        payload: bytesToBase64(env.payload),
        ttlHops: env.ttlHops,
        signature: bytesToBase64(env.signature),
        encryptionMetadata: {
          algorithm: env.encryptionMetadata.algorithm,
          nonce: bytesToBase64(env.encryptionMetadata.nonce),
          ephemeralPublicKey: bytesToBase64(env.encryptionMetadata.ephemeralPublicKey),
        },
      });
    });
  }

  async envelopeExists(id: string): Promise<boolean> {
    const state = this.load();
    return state.envelopes.some(envelope => envelope.envelopeId === id);
  }

  async getEnvelopes(chatScope: 'dm' | 'room', targetId: string, limit = 100): Promise<Envelope[]> {
    const state = this.load();
    return state.envelopes
      .filter(envelope => envelope.chatScope === chatScope && (chatScope === 'dm' ? envelope.senderDeviceId === targetId : envelope.roomId === targetId))
      .sort((left, right) => right.timestampUtc - left.timestampUtc)
      .slice(0, limit)
      .reverse()
      .map(envelope => ({
        envelopeId: envelope.envelopeId,
        protocolVersion: envelope.protocolVersion,
        timestampUtc: envelope.timestampUtc,
        senderDeviceId: envelope.senderDeviceId,
        senderNickname: envelope.senderNickname,
        recipientDeviceId: (envelope as { recipientDeviceId?: string }).recipientDeviceId ?? '',
        chatScope: envelope.chatScope,
        roomId: envelope.roomId,
        messageType: envelope.messageType,
        payload: base64ToBytes(envelope.payload),
        ttlHops: envelope.ttlHops,
        signature: base64ToBytes(envelope.signature),
        encryptionMetadata: {
          algorithm: envelope.encryptionMetadata.algorithm,
          nonce: base64ToBytes(envelope.encryptionMetadata.nonce),
          ephemeralPublicKey: base64ToBytes(envelope.encryptionMetadata.ephemeralPublicKey),
        },
      }));
  }

  async saveContact(contact: Contact): Promise<void> {
    this.update(state => {
      const storedContact: StoredContact = {
        deviceId: contact.deviceId,
        nickname: contact.nickname,
        publicKey: bytesToBase64(contact.publicKey),
        signingPublicKey: bytesToBase64(contact.signingPublicKey),
        trustState: contact.trustState,
        firstSeenAt: contact.firstSeenAt,
        lastSeenAt: contact.lastSeenAt,
      };

      const index = state.contacts.findIndex(existing => existing.deviceId === contact.deviceId);
      if (index >= 0) {
        state.contacts[index] = storedContact;
        return;
      }

      state.contacts.push(storedContact);
    });
  }

  async getContact(deviceId: string): Promise<Contact | null> {
    const state = this.load();
    const contact = state.contacts.find(entry => entry.deviceId === deviceId);
    return contact ? this.rowToContact(contact) : null;
  }

  async getAllContacts(): Promise<Contact[]> {
    const state = this.load();
    return [...state.contacts]
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
      .map(contact => this.rowToContact(contact));
  }

  private rowToContact(r: StoredContact): Contact {
    return {
      deviceId: r.deviceId,
      nickname: r.nickname,
      publicKey: base64ToBytes(r.publicKey),
      signingPublicKey: base64ToBytes(r.signingPublicKey),
      trustState: r.trustState,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
    };
  }

  async saveRoom(room: Room): Promise<void> {
    this.update(state => {
      const storedRoom: StoredRoom = {
        id: room.id,
        name: room.name,
        createdAt: room.createdAt,
        memberDeviceIds: [...room.memberDeviceIds],
      };

      const index = state.rooms.findIndex(existing => existing.id === room.id);
      if (index >= 0) {
        state.rooms[index] = storedRoom;
        return;
      }

      state.rooms.push(storedRoom);
    });
  }

  async getRoom(id: string): Promise<Room | null> {
    const state = this.load();
    const room = state.rooms.find(entry => entry.id === id);
    if (!room) return null;

    return {
      id: room.id,
      name: room.name,
      createdAt: room.createdAt,
      memberDeviceIds: [...room.memberDeviceIds],
    };
  }

  async getAllRooms(): Promise<Room[]> {
    const state = this.load();
    return state.rooms.map(room => ({
      id: room.id,
      name: room.name,
      createdAt: room.createdAt,
      memberDeviceIds: [...room.memberDeviceIds],
    }));
  }

  close(): void {
    return;
  }
}
