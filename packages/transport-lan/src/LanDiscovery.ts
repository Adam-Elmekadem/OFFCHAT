import { createSocket, type Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { networkInterfaces } from 'node:os';

export const DISCOVERY_PORT = 41891;
const ANNOUNCE_INTERVAL_MS = 3_000;

function subnetBroadcast(ip: string, netmask: string): string {
  const a = ip.split('.').map(Number);
  const m = netmask.split('.').map(Number);
  return a.map((b, i) => (b | (~(m[i] ?? 0) & 0xff))).join('.');
}

export interface AnnouncePacket {
  v: number;
  deviceId: string;
  nickname: string;
  tcpPort: number;
  publicKey: string;
  status?: string | undefined;
  bio?: string | undefined;
}

export class LanDiscovery extends EventEmitter {
  private socket: Socket | null = null;
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  private profile: { status: string; bio: string };

  constructor(
    private readonly deviceId: string,
    private readonly nickname: string,
    private readonly tcpPort: number,
    private readonly publicKeyHex: string,
    profile?: { status?: string; bio?: string },
  ) {
    super();
    this.profile = { status: profile?.status ?? 'online', bio: profile?.bio ?? '' };
  }

  setProfile(profile: { status: string; bio: string }): void {
    this.profile = profile;
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
      status: this.profile.status,
      ...(this.profile.bio ? { bio: this.profile.bio } : {}),
    };
    const buf = Buffer.from(JSON.stringify(packet));

    // Send the subnet broadcast (e.g. 10.237.101.255) from every
    // non-loopback IPv4 interface. Subnet-directed broadcasts cross
    // more routers/hotspots than the limited 255.255.255.255 broadcast.
    const ifaces = Object.values(networkInterfaces())
      .flat()
      .filter((n): n is NonNullable<typeof n> =>
        n !== undefined && n.family === 'IPv4' && !n.internal,
      );

    const targets = ifaces.length > 0 ? ifaces : [{ address: '0.0.0.0', netmask: '0.0.0.0' }];
    for (const iface of targets) {
      const bcast = subnetBroadcast(iface.address, iface.netmask);
      const sock = createSocket({ type: 'udp4', reuseAddr: true });
      sock.bind(0, iface.address === '0.0.0.0' ? undefined : iface.address, () => {
        sock.setBroadcast(true);
        sock.send(buf, DISCOVERY_PORT, bcast, () => sock.close());
      });
      sock.on('error', () => sock.close());
    }
  }
}
