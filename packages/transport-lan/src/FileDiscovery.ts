import { writeFileSync, readFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { EventEmitter } from 'node:events';

const PEERS_DIR = join(homedir(), '.offchat', 'peers');
const STALE_MS = 10_000;
const REFRESH_MS = 2_000;

interface PeerFile {
  v: number;
  deviceId: string;
  nickname: string;
  tcpPort: number;
  publicKey: string;
  updatedAt: number;
  status?: string | undefined;
  bio?: string | undefined;
}

export class FileDiscovery extends EventEmitter {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly myFile: string;
  private profile: { status: string; bio: string };

  constructor(
    private readonly deviceId: string,
    private readonly nickname: string,
    private readonly tcpPort: number,
    private readonly publicKeyHex: string,
    profile?: { status?: string; bio?: string },
  ) {
    super();
    this.myFile = join(PEERS_DIR, `${deviceId}.json`);
    this.profile = { status: profile?.status ?? 'online', bio: profile?.bio ?? '' };
  }

  setProfile(profile: { status: string; bio: string }): void {
    this.profile = profile;
  }

  start(): void {
    mkdirSync(PEERS_DIR, { recursive: true });
    this.write();
    this.scan();
    this.timer = setInterval(() => {
      this.write();
      this.scan();
    }, REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    try { unlinkSync(this.myFile); } catch { /* already gone */ }
  }

  private write(): void {
    const entry: PeerFile = {
      v: 1,
      deviceId: this.deviceId,
      nickname: this.nickname,
      tcpPort: this.tcpPort,
      publicKey: this.publicKeyHex,
      updatedAt: Date.now(),
      status: this.profile.status,
      ...(this.profile.bio ? { bio: this.profile.bio } : {}),
    };
    writeFileSync(this.myFile, JSON.stringify(entry));
  }

  private scan(): void {
    let files: string[];
    try {
      files = readdirSync(PEERS_DIR);
    } catch {
      return;
    }

    const cutoff = Date.now() - STALE_MS;
    for (const f of files) {
      if (!f.endsWith('.json') || f === `${this.deviceId}.json`) continue;
      try {
        const raw = readFileSync(join(PEERS_DIR, f), 'utf8');
        const peer = JSON.parse(raw) as PeerFile;
        if (peer.v !== 1 || peer.updatedAt < cutoff) continue;
        this.emit('peer', { ...peer, address: '127.0.0.1' });
      } catch { /* skip corrupted */ }
    }
  }
}
