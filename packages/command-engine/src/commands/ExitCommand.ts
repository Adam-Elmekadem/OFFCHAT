import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class ExitCommand implements ICommand {
  readonly name = 'exit';
  readonly description = 'Exit OFFCHAT';
  readonly usage = '/exit';

  async execute(_args: string[], ctx: CommandContext): Promise<CommandResult> {
    ctx.emit({ type: 'exit' });
    return { output: 'bye', error: false };
  }
}
