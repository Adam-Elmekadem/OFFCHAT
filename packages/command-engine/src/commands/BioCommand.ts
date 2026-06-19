import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class BioCommand implements ICommand {
  readonly name = 'bio';
  readonly description = 'Set a short bio shown to peers in the peer list';
  readonly usage = '/bio <text>  (empty to clear)';

  async execute(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const text = args.join(' ').trim();
    if (text.length > 60) return { output: 'bio too long (max 60 chars)', error: true };
    ctx.setProfile({ bio: text });
    return { output: text ? `bio set: "${text}"` : 'bio cleared', error: false };
  }
}
