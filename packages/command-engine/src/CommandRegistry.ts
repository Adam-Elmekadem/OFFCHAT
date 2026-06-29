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
  // call events: App → Container
  | { type: 'call-initiate'; deviceId: string }
  | { type: 'call-accept' }
  | { type: 'call-reject' }
  | { type: 'call-hangup' }
  | { type: 'call-ptt-start' }
  | { type: 'call-ptt-stop' }
  // call events: Container → App
  | { type: 'call-state'; state: 'idle' | 'calling' | 'ringing' | 'active'; peerNickname?: string | undefined }
  | { type: 'call-incoming'; peerNickname: string; peerDeviceId: string }
  // trust events: App → Container
  | { type: 'peer-trust'; deviceId: string; trustState: 'trusted' | 'unverified' | 'blocked' }
  // trust events: Container → App
  | { type: 'trust-changed'; deviceId: string; trustState: 'trusted' | 'unverified' | 'blocked' }
  | { type: 'message-from-unverified'; deviceId: string; nickname: string }
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
