import { createServer, createConnection, type Server, type Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { serializeEnvelope, deserializeEnvelope } from '@offchat/protocol';
import { LanDiscovery } from './LanDiscovery.js';
import { FileDiscovery } from './FileDiscovery.js';
import type { ITransport, Envelope, PeerInfo } from '@offchat/domain';

const SCORE = 60;

interface PeerConnection {
  info: PeerInfo;
  socket: Socket;
}

export class LanTransport extends EventEmitter implements ITransport {
  readonly name = 'lan' as const;

  private server: Server | null = null;
  private lanDiscovery: LanDiscovery | null = null;
  private fileDiscovery: FileDiscovery | null = null;
  private readonly peers = new Map<string, PeerConnection>();
  private receiveHandler?: (envelope: Envelope, from: PeerInfo) => Promise<void>;
  private readonly discoveredPeers = new Map<string, PeerInfo>();
  private tcpPort = 0;

  constructor(
    private readonly deviceId: string,
    private readonly nickname: string,
    private readonly publicKeyHex: string,
    private readonly publicKey: Uint8Array,
  ) {
    super();
  }

  async start(): Promise<void> {
    await this.startTcpServer();

    const onPeer = (p: { deviceId: string; nickname: string; address: string; tcpPort: number; publicKey: string }) => {
      if (this.discoveredPeers.has(p.deviceId)) return;
      const peerInfo: PeerInfo = {
        deviceId: p.deviceId,
        nickname: p.nickname,
        address: `${p.address}:${p.tcpPort}`,
        transport: 'lan',
        publicKey: Buffer.from(p.publicKey, 'hex'),
      };
      this.discoveredPeers.set(p.deviceId, peerInfo);
      this.emit('peer-discovered', peerInfo);
    };

    // File-based: same-machine peers (guaranteed on Windows)
    this.fileDiscovery = new FileDiscovery(this.deviceId, this.nickname, this.tcpPort, this.publicKeyHex);
    this.fileDiscovery.on('peer', onPeer);
    this.fileDiscovery.start();

    // UDP broadcast: peers on other machines on the same LAN
    this.lanDiscovery = new LanDiscovery(this.deviceId, this.nickname, this.tcpPort, this.publicKeyHex);
    this.lanDiscovery.on('peer', onPeer);
    this.lanDiscovery.on('error', () => { /* non-fatal if UDP unavailable */ });
    this.lanDiscovery.start();
  }

  async stop(): Promise<void> {
    this.fileDiscovery?.stop();
    this.lanDiscovery?.stop();
    for (const { socket } of this.peers.values()) socket.destroy();
    this.peers.clear();
    await new Promise<void>(res => this.server?.close(() => res()));
    this.server = null;
  }

  async send(peerId: string, envelope: Envelope): Promise<void> {
    const conn = await this.getOrConnect(peerId);
    const data = serializeEnvelope(envelope);
    const lenBuf = Buffer.allocUnsafe(4);
    lenBuf.writeUInt32BE(data.length, 0);
    await new Promise<void>((resolve, reject) => {
      conn.socket.write(Buffer.concat([lenBuf, data]), err => err ? reject(err) : resolve());
    });
  }

  async *discover(): AsyncGenerator<PeerInfo> {
    for (const p of this.discoveredPeers.values()) yield p;
    while (true) await new Promise<void>(() => {});
  }

  onReceive(handler: (envelope: Envelope, from: PeerInfo) => Promise<void>): void {
    this.receiveHandler = handler;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getScore(): number {
    return SCORE;
  }

  private startTcpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(socket => this.handleIncoming(socket));
      this.server.on('error', reject);
      this.server.listen(0, '0.0.0.0', () => {
        const addr = this.server!.address();
        this.tcpPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  }

  private handleIncoming(socket: Socket): void {
    let buf = Buffer.alloc(0);
    let channelRegistered = false;

    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4) {
        const len = buf.readUInt32BE(0);
        if (buf.length < 4 + len) break;
        const payload = buf.slice(4, 4 + len);
        buf = buf.slice(4 + len);
        try {
          const envelope = deserializeEnvelope(payload);
          const knownPeer = this.discoveredPeers.get(envelope.senderDeviceId);

          // Register the inbound socket as a bidirectional channel so the
          // receiver can reply without opening a second TCP connection.
          if (!channelRegistered && knownPeer && !this.peers.has(envelope.senderDeviceId)) {
            const conn = { info: knownPeer, socket };
            this.peers.set(envelope.senderDeviceId, conn);
            socket.on('close', () => this.peers.delete(envelope.senderDeviceId));
            channelRegistered = true;
          }

          const from: PeerInfo = {
            deviceId: envelope.senderDeviceId,
            nickname: envelope.senderNickname,
            address: socket.remoteAddress ?? '',
            transport: 'lan',
            publicKey: knownPeer?.publicKey ?? envelope.encryptionMetadata.ephemeralPublicKey,
          };
          this.receiveHandler?.(envelope, from)?.catch(err => this.emit('recv-error', err));
        } catch {
          // drop malformed
        }
      }
    });
  }

  private async getOrConnect(peerId: string): Promise<PeerConnection> {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const peer = this.discoveredPeers.get(peerId);
    if (!peer) throw new Error(`no route to peer ${peerId}`);

    const [host, portStr] = peer.address.split(':');
    const port = parseInt(portStr ?? '0', 10);

    return new Promise<PeerConnection>((resolve, reject) => {
      const socket = createConnection({ host, port }, () => {
        const conn: PeerConnection = { info: peer, socket };
        this.peers.set(peerId, conn);
        socket.on('close', () => this.peers.delete(peerId));
        resolve(conn);
      });
      socket.on('error', reject);
    });
  }
}
