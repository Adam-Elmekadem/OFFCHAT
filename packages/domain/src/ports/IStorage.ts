import type { Identity } from '../entities/Identity.js';
import type { Contact } from '../entities/Contact.js';
import type { Room } from '../entities/Room.js';
import type { Envelope } from '../entities/Envelope.js';

export interface IStorage {
  getIdentity(): Promise<Identity | null>;
  saveIdentity(identity: Identity): Promise<void>;

  saveEnvelope(envelope: Envelope): Promise<void>;
  envelopeExists(id: string): Promise<boolean>;
  getEnvelopes(chatScope: 'dm' | 'room', targetId: string, limit?: number): Promise<Envelope[]>;

  saveContact(contact: Contact): Promise<void>;
  getContact(deviceId: string): Promise<Contact | null>;
  getAllContacts(): Promise<Contact[]>;

  saveRoom(room: Room): Promise<void>;
  getRoom(id: string): Promise<Room | null>;
  getAllRooms(): Promise<Room[]>;
}
