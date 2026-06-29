import type { IStorage, Contact, TrustState } from '@offchat/domain';

export class TrustContact {
  constructor(private readonly storage: IStorage) {}

  async execute(deviceId: string, trustState: TrustState): Promise<Contact | null> {
    const contact = await this.storage.getContact(deviceId);
    if (!contact) return null;
    const updated: Contact = { ...contact, trustState };
    await this.storage.saveContact(updated);
    return updated;
  }
}
