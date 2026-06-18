import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { CryptoAdapter } from '@offchat/security';
import { SqliteStorage } from '@offchat/storage';
import { LanTransport } from '@offchat/transport-lan';
import {
  TransportRouter,
  MessageDeduplicator,
  SetIdentity,
  SendMessage,
  ReceiveMessage,
  ConnectPeer,
} from '@offchat/application';
import {
  CommandRegistry,
  CommandParser,
  HelpCommand,
  NickCommand,
  OnlineCommand,
  ConnectCommand,
  HistoryCommand,
  ClearCommand,
  ExitCommand,
} from '@offchat/command-engine';
import type { CommandContext, AppEvent } from '@offchat/command-engine';
import type { Identity } from '@offchat/domain';

function profileDir(nickname: string): string {
  const safe = nickname.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return join(homedir(), '.offchat', safe);
}

export interface Container {
  identity: Identity;
  router: TransportRouter;
  sendMessage: SendMessage;
  receiveMessage: ReceiveMessage;
  commandParser: CommandParser;
  storage: SqliteStorage;
  lanTransport: LanTransport;
}

export async function buildContainer(
  nickname: string,
  emit: (e: AppEvent) => void,
): Promise<Container> {
  const DATA_DIR = profileDir(nickname);
  mkdirSync(DATA_DIR, { recursive: true });

  const crypto = new CryptoAdapter();
  const storage = new SqliteStorage(join(DATA_DIR, 'offchat-storage.json'));

  const setIdentity = new SetIdentity(crypto, storage);
  const identity = await setIdentity.execute({ nickname });

  const router = new TransportRouter();
  const deduplicator = new MessageDeduplicator();
  const connectPeer = new ConnectPeer(storage, router);

  const lanTransport = new LanTransport(
    identity.id,
    identity.nickname,
    Buffer.from(identity.publicKey).toString('hex'),
    identity.publicKey,
  );

  router.register(lanTransport);

  const receiveMessage = new ReceiveMessage(crypto, storage, deduplicator, identity);
  const sendMessage = new SendMessage(crypto, storage, router, identity);

  lanTransport.onReceive(async (envelope, from) => {
    try {
      await connectPeer.fromDiscovery(from, lanTransport);
      await receiveMessage.handle(envelope, from);
    } catch (err) {
      emit({ type: 'system-message', text: `recv error: ${String(err)}` });
    }
  });

  lanTransport.on('recv-error', (err: Error) => {
    emit({ type: 'system-message', text: `recv error: ${err.message}` });
  });

  lanTransport.on('peer-discovered', async (peer: import('@offchat/domain').PeerInfo) => {
    const contact = await connectPeer.fromDiscovery(peer, lanTransport);
    emit({ type: 'peer-found', deviceId: peer.deviceId, nickname: peer.nickname, transport: peer.transport, contact });
  });

  lanTransport.on('peer-lost', (deviceId: string) => {
    emit({ type: 'peer-lost', deviceId });
  });

  const cmdRegistry = new CommandRegistry();
  const cmdContext: CommandContext = {
    identity,
    storage,
    sendMessage,
    connectPeer,
    emit,
  };

  cmdRegistry.register(new HelpCommand(() => cmdRegistry.all()));
  cmdRegistry.register(new NickCommand());
  cmdRegistry.register(new OnlineCommand());
  cmdRegistry.register(new ConnectCommand());
  cmdRegistry.register(new HistoryCommand());
  cmdRegistry.register(new ClearCommand());
  cmdRegistry.register(new ExitCommand());

  const commandParser = new CommandParser(cmdRegistry, cmdContext);

  return { identity, router, sendMessage, receiveMessage, commandParser, storage, lanTransport };
}
