import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class ContactsCommand implements ICommand {
  readonly name = 'contacts';
  readonly description = 'List all known contacts and their trust state';
  readonly usage = '/contacts';

  async execute(_args: string[], ctx: CommandContext): Promise<CommandResult> {
    const contacts = await ctx.storage.getAllContacts();
    if (contacts.length === 0) {
      return { output: 'no contacts yet — peers are saved when they are first discovered', error: false };
    }

    const badge = (s: string) =>
      s === 'trusted' ? '[T]' : s === 'blocked' ? '[X]' : '[?]';

    const lines = contacts.map(c =>
      `${badge(c.trustState)} ${c.nickname.padEnd(14)} ${c.deviceId.slice(0, 8)}…  last seen ${new Date(c.lastSeenAt).toLocaleDateString()}`,
    );

    return { output: lines.join('\n'), error: false };
  }
}
