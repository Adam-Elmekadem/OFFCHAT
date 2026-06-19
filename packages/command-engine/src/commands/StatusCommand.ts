import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

const VALID = ['online', 'away', 'busy'] as const;
type Status = typeof VALID[number];

export class StatusCommand implements ICommand {
  readonly name = 'status';
  readonly description = 'Set your status visible to peers';
  readonly usage = '/status <online|away|busy>';

  async execute(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const s = args[0]?.toLowerCase().trim() as Status | undefined;
    if (!s || !VALID.includes(s)) {
      return { output: `usage: /status <${VALID.join('|')}>`, error: true };
    }
    ctx.setProfile({ status: s });
    return { output: `status set to "${s}"`, error: false };
  }
}
