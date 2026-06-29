import type { Envelope } from '@offchat/domain';

const MAX_ATTEMPTS  = 3;
const RETRY_INTERVAL_MS = 5_000;

interface Pending {
  envelope:     Envelope;
  recipientId:  string;
  recipientKey: Uint8Array;
  attempts:     number;
  lastAttempt:  number;
}

export class RetryQueue {
  private readonly pending = new Map<string, Pending>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(
    retryFn: (env: Envelope, recipientId: string, key: Uint8Array) => Promise<void>,
    onFailed: (envelopeId: string) => void,
  ): void {
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [id, msg] of this.pending) {
        if (now - msg.lastAttempt < RETRY_INTERVAL_MS) continue;
        if (msg.attempts >= MAX_ATTEMPTS) {
          this.pending.delete(id);
          onFailed(id);
          continue;
        }
        msg.attempts++;
        msg.lastAttempt = now;
        retryFn(msg.envelope, msg.recipientId, msg.recipientKey).catch(() => {});
      }
    }, 1_000);
  }

  add(env: Envelope, recipientId: string, recipientKey: Uint8Array): void {
    this.pending.set(env.envelopeId, {
      envelope: env, recipientId, recipientKey,
      attempts: 0, lastAttempt: Date.now(),
    });
  }

  ack(envelopeId: string): void {
    this.pending.delete(envelopeId);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
