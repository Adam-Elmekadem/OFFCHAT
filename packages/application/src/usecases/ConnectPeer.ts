import type { IStorage, Contact, PeerInfo } from '@offchat/domain';
import type { TransportRouter } from '../services/TransportRouter.js';

export class ConnectPeer {
  constructor(
    private readonly storage: IStorage,
    private readonly router: TransportRouter,
  ) {}

  async fromDiscovery(peer: PeerInfo, transport: import('@offchat/domain').ITransport): Promise<Contact> {
    this.router.registerRoute(peer.deviceId, transport);

    const existing = await this.storage.getContact(peer.deviceId);
    const contact: Contact = {
      deviceId: peer.deviceId,
      nickname: peer.nickname,
      publicKey: peer.publicKey,
      signingPublicKey: peer.publicKey,
      trustState: existing?.trustState ?? 'unverified',
      firstSeenAt: existing?.firstSeenAt ?? Date.now(),
      lastSeenAt: Date.now(),
    };

    await this.storage.saveContact(contact);
    return contact;
  }

  async getOnline(): Promise<Contact[]> {
    return this.storage.getAllContacts();
  }
}
