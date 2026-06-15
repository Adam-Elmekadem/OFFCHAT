import { EventEmitter } from 'node:events';
import type { ITransport, Envelope, PeerInfo } from '@offchat/domain';

export class FakeTransport extends EventEmitter implements ITransport {
  readonly name = 'lan' as const;
  readonly sent: Array<{ peerId: string; envelope: Envelope }> = [];
  private receiveHandler?: (envelope: Envelope, from: PeerInfo) => Promise<void>;
  private _available = true;
  private _score = 60;

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async send(peerId: string, envelope: Envelope): Promise<void> {
    this.sent.push({ peerId, envelope });
  }

  async *discover(): AsyncGenerator<PeerInfo> {
    for (const peer of this._peers) yield peer;
  }

  onReceive(handler: (envelope: Envelope, from: PeerInfo) => Promise<void>): void {
    this.receiveHandler = handler;
  }

  async isAvailable(): Promise<boolean> {
    return this._available;
  }

  getScore(): number {
    return this._score;
  }

  setAvailable(v: boolean): void {
    this._available = v;
  }

  private readonly _peers: PeerInfo[] = [];

  addPeer(peer: PeerInfo): void {
    this._peers.push(peer);
  }

  async simulateReceive(envelope: Envelope, from: PeerInfo): Promise<void> {
    await this.receiveHandler?.(envelope, from);
  }
}
