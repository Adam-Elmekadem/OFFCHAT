import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class ConnectCommand implements ICommand {
  readonly name = 'connect';
  readonly description = 'Connect to a peer by device ID';
  readonly usage = '/connect <device-id>';

  async execute(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const deviceId = args[0]?.trim();
    if (!deviceId) return { output: 'usage: /connect <device-id>', error: true };

    const contact = await ctx.storage.getContact(deviceId);
    if (!contact) {
      return { output: `unknown peer: ${deviceId}. Wait for discovery or check the ID.`, error: true };
    }

    ctx.emit({ type: 'peer-connected', contact });
    return { output: `now chatting with ${contact.nickname} [${contact.trustState}]`, error: false };
  }
}
