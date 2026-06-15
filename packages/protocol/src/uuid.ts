import { randomBytes } from 'node:crypto';

export function newId(): string {
  const now = BigInt(Date.now());
  const hi = now >> 4n;
  const lo = now & 0xfffn;

  const buf = randomBytes(10);
  const randHi = ((buf[0]! & 0x0f) | 0x70).toString(16).padStart(2, '0')
    + buf.slice(1, 3).toString('hex');
  const randLo = ((buf[3]! & 0x3f) | 0x80).toString(16).padStart(2, '0')
    + buf.slice(4, 10).toString('hex');

  const p1 = hi.toString(16).padStart(8, '0');
  const p2 = (((lo << 4n) | 7n) & 0xffffn).toString(16).padStart(4, '0');
  return `${p1}-${p2}-${randHi}-${randLo.slice(0, 4)}-${randLo.slice(4)}`;
}
