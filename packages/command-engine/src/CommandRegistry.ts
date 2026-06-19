import type { IStorage, Identity, Contact } from '@offchat/domain';
import type { SendMessage, ConnectPeer } from '@offchat/application';

export interface CommandContext {
  identity: Identity | null;
  storage: IStorage;
  sendMessage: SendMessage | null;
  connectPeer: ConnectPeer;
  emit: (event: AppEvent) => void;
  setProfile: (update: { status?: string; bio?: string }) => void;
}

export type AppEvent =
  | { type: 'system-message'; text: string }
  | { type: 'nick-changed'; nickname: string }
  | { type: 'peer-connected'; contact: Contact }
  | { type: 'peer-found'; deviceId: string; nickname: string; transport: string; contact: Contact; status?: string | undefined; bio?: string | undefined }
  | { type: 'peer-updated'; deviceId: string; status: string; bio?: string | undefined }
  | { type: 'peer-lost'; deviceId: string }
  | { type: 'exit' };

export interface CommandResult {
  output: string | null;
  error: boolean;
}

export interface ICommand {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  execute(args: string[], ctx: CommandContext): Promise<CommandResult>;
}

export class CommandRegistry {
  private readonly commands = new Map<string, ICommand>();

  register(cmd: ICommand): void {
    this.commands.set(cmd.name, cmd);
  }

  get(name: string): ICommand | undefined {
    return this.commands.get(name);
  }

  all(): ICommand[] {
    return [...this.commands.values()];
  }
}
