import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class HistoryCommand implements ICommand {
  readonly name = 'history';
  readonly description = 'Show recent message history';
  readonly usage = '/history [limit]';

  async execute(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const limit = Math.min(parseInt(args[0] ?? '50', 10), 200);
    if (!ctx.identity) return { output: 'not initialized', error: true };

    const envelopes = await ctx.storage.getEnvelopes('dm', ctx.identity.id, limit);
    if (envelopes.length === 0) {
      return { output: 'no history yet', error: false };
    }

    const lines = envelopes.map(env => {
      const ts = new Date(env.timestampUtc).toLocaleTimeString();
      return `[${ts}] ${env.senderNickname}: <encrypted>`;
    });
    return { output: lines.join('\n'), error: false };
  }
}
