import { createServer, createConnection, type Server, type Socket } from 'node:net';
import { createSocket, type Socket as UdpSocket } from 'node:dgram';
import type { AddressInfo } from 'node:net';
import { EventEmitter } from 'node:events';
import { serializeEnvelope, deserializeEnvelope } from '@offchat/protocol';
import { shouldRelay, decrementTtl } from '@offchat/domain';
import { LanDiscovery } from './LanDiscovery.js';
import { FileDiscovery } from './FileDiscovery.js';
import type { ITransport, Envelope, PeerInfo, PeerStatus } from '@offchat/domain';

const SCORE        = 60;
const PEER_TTL_MS  = 10_000;

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
  private readonly peerLastSeen   = new Map<string, number>();
  private expireTimer: ReturnType<typeof setInterval> | null = null;
  private tcpPort    = 0;
  private currentProfile: { status: string; bio: string };

  // Audio UDP socket (opened on /call)
  private audioSocket: UdpSocket | null = null;
  private audioPort  = 0;

  constructor(
    private readonly deviceId: string,
    private readonly nickname: string,
    private readonly publicKeyHex: string,
    private readonly publicKey: Uint8Array,
    profile?: { status?: string; bio?: string },
  ) {
    super();
    this.currentProfile = { status: profile?.status ?? 'online', bio: profile?.bio ?? '' };
  }

  setProfile(profile: { status: string; bio: string }): void {
    this.currentProfile = profile;
    this.lanDiscovery?.setProfile(profile);
    this.fileDiscovery?.setProfile(profile);
  }

  getDiscoveredPeers(): Map<string, PeerInfo> {
    return this.discoveredPeers;
  }

  // ── Audio UDP ────────────────────────────────────────────────
  startAudio(onChunk: (chunk: Buffer, fromAddress: string) => void): Promise<number> {
    return new Promise(resolve => {
      this.audioSocket = createSocket('udp4');
      this.audioSocket.on('message', (msg, rinfo) => onChunk(msg, rinfo.address));
      this.audioSocket.bind(0, () => {
        this.audioPort = (this.audioSocket!.address() as AddressInfo).port;
        resolve(this.audioPort);
      });
    });
  }

  sendAudio(chunk: Buffer, peerAddress: string, peerAudioPort: number): void {
    this.audioSocket?.send(chunk, peerAudioPort, peerAddress.split(':')[0] ?? peerAddress);
  }

  stopAudio(): void {
    this.audioSocket?.close();
    this.audioSocket = null;
    this.audioPort   = 0;
  }

  getPeerAddress(deviceId: string): string | undefined {
    const peer = this.discoveredPeers.get(deviceId);
    if (!peer) return undefined;
    return peer.address.split(':')[0]; // strip :port, keep IP
  }

  // ── Mesh relay ───────────────────────────────────────────────
  async relay(envelope: Envelope, fromDeviceId: string): Promise<void> {
    const relayed = decrementTtl(envelope);
    for (const [deviceId] of this.discoveredPeers) {
      if (deviceId === fromDeviceId) continue; // don't echo back to sender
      try { await this.send(deviceId, relayed); } catch { /* best-effort */ }
    }
  }

  // ── ITransport lifecycle ─────────────────────────────────────
  async start(): Promise<void> {
    await this.startTcpServer();

    const onPeer = (p: { deviceId: string; nickname: string; address: string; tcpPort: number; publicKey: string; status?: string; bio?: string }) => {
      this.peerLastSeen.set(p.deviceId, Date.now());

      const existing = this.discoveredPeers.get(p.deviceId);
      if (existing) {
        const newStatus = (p.status ?? 'online') as PeerStatus;
        const newBio = p.bio;
        if (existing.status !== newStatus || existing.bio !== newBio) {
          existing.status = newStatus;
          if (newBio != null) existing.bio = newBio; else delete existing.bio;
          this.emit('peer-updated', { deviceId: p.deviceId, status: newStatus, ...(newBio != null ? { bio: newBio } : {}) });
        }
        return;
      }

      const peerInfo: PeerInfo = {
        deviceId:  p.deviceId,
        nickname:  p.nickname,
        address:   `${p.address}:${p.tcpPort}`,
        transport: 'lan',
        publicKey: Buffer.from(p.publicKey, 'hex'),
        status:    (p.status ?? 'online') as PeerStatus,
        ...(p.bio != null ? { bio: p.bio } : {}),
      };
      this.discoveredPeers.set(p.deviceId, peerInfo);
      this.emit('peer-discovered', peerInfo);
    };

    this.fileDiscovery = new FileDiscovery(this.deviceId, this.nickname, this.tcpPort, this.publicKeyHex, this.currentProfile);
    this.fileDiscovery.on('peer', onPeer);
    this.fileDiscovery.start();

    this.lanDiscovery = new LanDiscovery(this.deviceId, this.nickname, this.tcpPort, this.publicKeyHex, this.currentProfile);
    this.lanDiscovery.on('peer', onPeer);
    this.lanDiscovery.on('error', () => {});
    this.lanDiscovery.start();

    this.expireTimer = setInterval(() => this.expireStale(), 5_000);
  }

  async stop(): Promise<void> {
    if (this.expireTimer) clearInterval(this.expireTimer);
    this.fileDiscovery?.stop();
    this.lanDiscovery?.stop();
    this.stopAudio();
    for (const { socket } of this.peers.values()) socket.destroy();
    this.peers.clear();
    await new Promise<void>(res => this.server?.close(() => res()));
    this.server = null;
  }

  private expireStale(): void {
    const now = Date.now();
    for (const [deviceId, lastSeen] of this.peerLastSeen) {
      if (now - lastSeen > PEER_TTL_MS) {
        this.peerLastSeen.delete(deviceId);
        this.discoveredPeers.delete(deviceId);
        const conn = this.peers.get(deviceId);
        if (conn) { conn.socket.destroy(); this.peers.delete(deviceId); }
        this.emit('peer-lost', deviceId);
      }
    }
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

  async isAvailable(): Promise<boolean> { return true; }
  getScore(): number { return SCORE; }

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

  private attachReceiver(socket: Socket): void {
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
          const envelope   = deserializeEnvelope(payload);
          const knownPeer  = this.discoveredPeers.get(envelope.senderDeviceId);

          if (!channelRegistered && knownPeer && !this.peers.has(envelope.senderDeviceId)) {
            const conn = { info: knownPeer, socket };
            this.peers.set(envelope.senderDeviceId, conn);
            socket.on('close', () => this.peers.delete(envelope.senderDeviceId));
            channelRegistered = true;
          }

          const from: PeerInfo = {
            deviceId:  envelope.senderDeviceId,
            nickname:  envelope.senderNickname,
            address:   socket.remoteAddress ?? '',
            transport: 'lan',
            publicKey: knownPeer?.publicKey ?? envelope.encryptionMetadata.ephemeralPublicKey,
          };

          this.receiveHandler?.(envelope, from)?.catch(err => this.emit('recv-error', err));
        } catch { /* drop malformed */ }
      }
    });
  }

  private handleIncoming(socket: Socket): void {
    this.attachReceiver(socket);
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
        this.attachReceiver(socket);
        resolve(conn);
      });
      socket.on('error', reject);
    });
  }
}
