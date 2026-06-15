export type TransportType = 'lan' | 'bluetooth' | 'mesh';

export interface Device {
  id: string;
  nickname: string;
  address: string;
  transport: TransportType;
  online: boolean;
  lastSeenAt: number;
}
