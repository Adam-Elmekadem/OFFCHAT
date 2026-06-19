import type { Envelope } from '../entities/Envelope.js';
import type { TransportType } from '../entities/Device.js';

export type PeerStatus = 'online' | 'away' | 'busy';

export interface PeerInfo {
  deviceId: string;
  nickname: string;
  address: string;
  transport: TransportType;
  publicKey: Uint8Array;
  status?: PeerStatus | undefined;
  bio?: string | undefined;
}

export interface ITransport {
  readonly name: TransportType;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(peerId: string, envelope: Envelope): Promise<void>;
  discover(): AsyncGenerator<PeerInfo>;
  onReceive(handler: (envelope: Envelope, from: PeerInfo) => Promise<void>): void;
  isAvailable(): Promise<boolean>;
  getScore(): number;
}
