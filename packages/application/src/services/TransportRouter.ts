import type { ITransport, Envelope } from '@offchat/domain';

export class TransportRouter {
  private readonly transports: ITransport[] = [];
  private readonly peerRoutes = new Map<string, ITransport>();

  register(transport: ITransport): void {
    this.transports.push(transport);
  }

  registerRoute(peerId: string, transport: ITransport): void {
    this.peerRoutes.set(peerId, transport);
  }

  async send(peerId: string, envelope: Envelope): Promise<void> {
    const pinned = this.peerRoutes.get(peerId);
    if (pinned) {
      try {
        await pinned.send(peerId, envelope);
        return;
      } catch {
        this.peerRoutes.delete(peerId);
      }
    }

    const available = await this.getAvailable();
    if (available.length === 0) throw new Error('no transport available');

    const best = available.sort((a, b) => b.getScore() - a.getScore())[0]!;
    await best.send(peerId, envelope);
    this.peerRoutes.set(peerId, best);
  }

  private async getAvailable(): Promise<ITransport[]> {
    const checks = this.transports.map(async t => ({ t, ok: await t.isAvailable() }));
    const results = await Promise.all(checks);
    return results.filter(r => r.ok).map(r => r.t);
  }

  async startAll(): Promise<void> {
    await Promise.all(this.transports.map(t => t.start()));
  }

  async stopAll(): Promise<void> {
    await Promise.all(this.transports.map(t => t.stop()));
  }

  getTransports(): ITransport[] {
    return [...this.transports];
  }
}
