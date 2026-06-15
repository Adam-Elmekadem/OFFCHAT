import type { ICommand, CommandContext, CommandResult } from '../CommandRegistry.js';

export class HelpCommand implements ICommand {
  constructor(private readonly getAll: () => ICommand[]) {}

  readonly name = 'help';
  readonly description = 'Show available commands';
  readonly usage = '/help';

  async execute(_args: string[], _ctx: CommandContext): Promise<CommandResult> {
    const lines = this.getAll().map(c => `  /${c.name.padEnd(14)} ${c.description}`);
    return { output: ['Commands:', ...lines].join('\n'), error: false };
  }
}
