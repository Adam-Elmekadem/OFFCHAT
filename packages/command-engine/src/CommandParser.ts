import type { CommandRegistry, CommandContext, CommandResult } from './CommandRegistry.js';

export class CommandParser {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly context: CommandContext,
  ) {}

  async parse(input: string): Promise<CommandResult> {
    const trimmed = input.trim();

    if (!trimmed.startsWith('/')) {
      return { output: null, error: false };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const name = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1);

    const cmd = this.registry.get(name);
    if (!cmd) {
      return { output: `unknown command: /${name} — type /help for a list`, error: true };
    }

    return cmd.execute(args, this.context);
  }
}
