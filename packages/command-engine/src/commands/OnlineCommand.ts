import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class OnlineCommand implements ICommand {
  readonly name = 'online';
  readonly description = 'List online contacts';
  readonly usage = '/online';

  async execute(_args: string[], ctx: CommandContext): Promise<CommandResult> {
    const contacts = await ctx.connectPeer.getOnline();
    if (contacts.length === 0) {
      return { output: 'no contacts online — they will appear when discovered', error: false };
    }
    const lines = contacts.map(c => {
      const trust = c.trustState === 'trusted' ? '✓' : '?';
      return `  [${trust}] ${c.nickname.padEnd(20)} ${c.deviceId}`;
    });
    return { output: ['Online contacts:', ...lines].join('\n'), error: false };
  }
}
