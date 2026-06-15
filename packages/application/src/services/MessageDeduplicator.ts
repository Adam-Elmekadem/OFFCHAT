export class MessageDeduplicator {
  private readonly seen = new Set<string>();
  private readonly ttl: number;
  private readonly timestamps = new Map<string, number>();

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttl = ttlMs;
  }

  isDuplicate(envelopeId: string): boolean {
    this.evict();
    return this.seen.has(envelopeId);
  }

  markSeen(envelopeId: string): void {
    this.seen.add(envelopeId);
    this.timestamps.set(envelopeId, Date.now());
  }

  private evict(): void {
    const cutoff = Date.now() - this.ttl;
    for (const [id, ts] of this.timestamps) {
      if (ts < cutoff) {
        this.seen.delete(id);
        this.timestamps.delete(id);
      }
    }
  }
}
