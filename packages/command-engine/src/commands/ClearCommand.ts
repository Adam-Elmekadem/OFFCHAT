import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class ClearCommand implements ICommand {
  readonly name = 'clear';
  readonly description = 'Clear the chat display';
  readonly usage = '/clear';

  async execute(_args: string[], ctx: CommandContext): Promise<CommandResult> {
    ctx.emit({ type: 'system-message', text: '\x1Bc' });
    return { output: null, error: false };
  }
}
