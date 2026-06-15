import { createSocket, type Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';

export const DISCOVERY_PORT = 41891;
const BROADCAST_ADDR = '255.255.255.255';
const ANNOUNCE_INTERVAL_MS = 3_000;

export interface AnnouncePacket {
  v: number;
  deviceId: string;
  nickname: string;
  tcpPort: number;
  publicKey: string;
}

export class LanDiscovery extends EventEmitter {
  private socket: Socket | null = null;
  private announceTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly deviceId: string,
    private readonly nickname: string,
    private readonly tcpPort: number,
    private readonly publicKeyHex: string,
  ) {
    super();
  }

  start(): void {
    this.socket = createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const packet = JSON.parse(msg.toString()) as AnnouncePacket;
        if (packet.v !== 1) return;
        if (packet.deviceId === this.deviceId) return;
        this.emit('peer', { ...packet, address: rinfo.address });
      } catch {
        // drop malformed packets
      }
    });

    // All announces start INSIDE the bind callback — socket must be ready first
    this.socket.bind(DISCOVERY_PORT, () => {
      this.socket!.setBroadcast(true);
      this.announceTimer = setInterval(() => this.announce(), ANNOUNCE_INTERVAL_MS);
      this.announce();
    });
  }

  stop(): void {
    if (this.announceTimer) clearInterval(this.announceTimer);
    this.socket?.close();
    this.socket = null;
  }

  private announce(): void {
    if (!this.socket) return;
    const packet: AnnouncePacket = {
      v: 1,
      deviceId: this.deviceId,
      nickname: this.nickname,
      tcpPort: this.tcpPort,
      publicKey: this.publicKeyHex,
    };
    const buf = Buffer.from(JSON.stringify(packet));
    this.socket.send(buf, DISCOVERY_PORT, BROADCAST_ADDR, (err) => {
      if (err) this.emit('error', err);
    });
  }
}
