import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class NickCommand implements ICommand {
  readonly name = 'nick';
  readonly description = 'Change your display name';
  readonly usage = '/nick <name>';

  async execute(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const name = args.join(' ').trim();
    if (!name) return { output: 'usage: /nick <name>', error: true };
    if (name.length > 32) return { output: 'nickname too long (max 32 chars)', error: true };

    ctx.emit({ type: 'nick-changed', nickname: name });
    return { output: `nickname set to ${name}`, error: false };
  }
}
