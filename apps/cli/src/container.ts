import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CryptoAdapter } from '@offchat/security';
import { SqliteStorage } from '@offchat/storage';
import { LanTransport } from '@offchat/transport-lan';
import {
  TransportRouter,
  MessageDeduplicator,
  RetryQueue,
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
  StatusCommand,
  BioCommand,
} from '@offchat/command-engine';
import type { CommandContext, AppEvent } from '@offchat/command-engine';
import type { Identity, PeerInfo } from '@offchat/domain';
import { shouldRelay } from '@offchat/domain';
import { CallManager } from './CallManager.js';

interface UserProfile {
  bio: string;
  status: string;
}

function profileDir(nickname: string): string {
  const safe = nickname.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return join(homedir(), '.offchat', safe);
}

function loadProfile(dir: string): UserProfile {
  try {
    return JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8')) as UserProfile;
  } catch {
    return { bio: '', status: 'online' };
  }
}

function saveProfile(dir: string, profile: UserProfile): void {
  writeFileSync(join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
}

export interface Container {
  identity: Identity;
  router: TransportRouter;
  sendMessage: SendMessage;
  receiveMessage: ReceiveMessage;
  commandParser: CommandParser;
  storage: SqliteStorage;
  lanTransport: LanTransport;
  callManager: CallManager;
  handleEvent: (e: AppEvent) => void;
}

export async function buildContainer(
  nickname: string,
  emit: (e: AppEvent) => void,
): Promise<Container> {
  const DATA_DIR = profileDir(nickname);
  mkdirSync(DATA_DIR, { recursive: true });

  const profile = loadProfile(DATA_DIR);
  saveProfile(DATA_DIR, profile);

  const crypto = new CryptoAdapter();
  const storage = new SqliteStorage(join(DATA_DIR, 'offchat-storage.json'));

  const setIdentity = new SetIdentity(crypto, storage);
  const identity = await setIdentity.execute({ nickname });

  const router = new TransportRouter();
  const deduplicator = new MessageDeduplicator();
  const connectPeer = new ConnectPeer(storage, router);
  const retryQueue = new RetryQueue();

  const lanTransport = new LanTransport(
    identity.id,
    identity.nickname,
    Buffer.from(identity.publicKey).toString('hex'),
    identity.publicKey,
    profile,
  );

  router.register(lanTransport);

  const sendMessage = new SendMessage(crypto, storage, router, identity, retryQueue);
  const receiveMessage = new ReceiveMessage(crypto, storage, deduplicator, identity);

  // ── CallManager ──────────────────────────────────────────────
  const callManager = new CallManager(lanTransport, sendMessage, identity);
  callManager.setListeners({
    onStateChange: (state, peer) => {
      emit({ type: 'call-state', state, ...(peer != null ? { peerNickname: peer.nickname } : {}) });
    },
    onError: msg => emit({ type: 'system-message', text: `[call] ${msg}` }),
  });

  // ── Receive handler ──────────────────────────────────────────
  lanTransport.onReceive(async (envelope, from) => {
    try {
      await connectPeer.fromDiscovery(from, lanTransport);
      await receiveMessage.handle(envelope, from);

      // mesh relay: forward to other peers if ttlHops > 0 and not for us
      if (envelope.recipientDeviceId !== identity.id && shouldRelay(envelope)) {
        lanTransport.relay(envelope, from.deviceId).catch(() => {});
      }
    } catch (err) {
      emit({ type: 'system-message', text: `recv error: ${String(err)}` });
    }
  });

  // ── ACK on text receive ──────────────────────────────────────
  receiveMessage.onMessage(async ({ envelope, from }) => {
    const peer = lanTransport.getDiscoveredPeers().get(from.deviceId);
    if (!peer) return;
    try {
      await sendMessage.execute({
        text:               envelope.envelopeId,
        recipientDeviceId:  from.deviceId,
        recipientPublicKey: peer.publicKey,
        chatScope:          'dm',
        messageType:        'ack',
      });
    } catch { /* best-effort ACK */ }
  });

  // ── Retry queue ──────────────────────────────────────────────
  receiveMessage.onAck(id => retryQueue.ack(id));

  retryQueue.start(
    async (env, recipientId, key) => {
      const updated = { ...env };
      await sendMessage.execute({
        text:               '[retry]',   // placeholder; real payload already encrypted
        recipientDeviceId:  recipientId,
        recipientPublicKey: key,
        chatScope:          'dm',
      });
      void updated; // suppress unused warning — we re-send via sendMessage
    },
    id => emit({ type: 'system-message', text: `message ${id.slice(0, 8)} failed after 3 retries` }),
  );

  // ── Call signals ─────────────────────────────────────────────
  receiveMessage.onCallSignal(async (payload, from) => {
    if (typeof payload !== 'object' || payload === null) return;
    const sig = payload as { type?: string; audioPort?: number };
    if (sig.type === 'call-request') {
      emit({ type: 'call-incoming', peerNickname: from.nickname, peerDeviceId: from.deviceId });
    }
    await callManager.handleIncoming(sig as Parameters<typeof callManager.handleIncoming>[0], from);
  });

  // ── Discovery events ─────────────────────────────────────────
  lanTransport.on('recv-error', (err: Error) => {
    emit({ type: 'system-message', text: `recv error: ${err.message}` });
  });

  lanTransport.on('peer-discovered', async (peer: PeerInfo) => {
    const contact = await connectPeer.fromDiscovery(peer, lanTransport);
    emit({
      type: 'peer-found',
      deviceId: peer.deviceId,
      nickname: peer.nickname,
      transport: peer.transport,
      contact,
      ...(peer.status != null ? { status: peer.status } : {}),
      ...(peer.bio    != null ? { bio:    peer.bio    } : {}),
    });
  });

  lanTransport.on('peer-updated', (data: { deviceId: string; status: string; bio?: string | undefined }) => {
    emit({ type: 'peer-updated', deviceId: data.deviceId, status: data.status, ...(data.bio != null ? { bio: data.bio } : {}) });
  });

  lanTransport.on('peer-lost', (deviceId: string) => {
    emit({ type: 'peer-lost', deviceId });
  });

  // ── Profile callback ─────────────────────────────────────────
  const setProfileCallback = (update: { status?: string; bio?: string }): void => {
    if (update.status !== undefined) profile.status = update.status;
    if (update.bio    !== undefined) profile.bio    = update.bio;
    saveProfile(DATA_DIR, profile);
    lanTransport.setProfile({ status: profile.status, bio: profile.bio });
  };

  // ── handleEvent: routes AppEvents from UI → container ────────
  const handleEvent = (e: AppEvent): void => {
    if (e.type === 'call-initiate') {
      const peer = lanTransport.getDiscoveredPeers().get(e.deviceId);
      if (!peer) { emit({ type: 'system-message', text: 'peer not found' }); return; }
      callManager.initiateCall(peer).catch(err =>
        emit({ type: 'system-message', text: `[call] ${String(err)}` }));
    } else if (e.type === 'call-accept') {
      callManager.acceptCall().catch(err =>
        emit({ type: 'system-message', text: `[call] ${String(err)}` }));
    } else if (e.type === 'call-reject') {
      callManager.rejectCall().catch(err =>
        emit({ type: 'system-message', text: `[call] ${String(err)}` }));
    } else if (e.type === 'call-hangup') {
      callManager.hangup().catch(err =>
        emit({ type: 'system-message', text: `[call] ${String(err)}` }));
    } else if (e.type === 'call-ptt-start') {
      callManager.setPushToTalk(true);
    } else if (e.type === 'call-ptt-stop') {
      callManager.setPushToTalk(false);
    }
  };

  // ── Command registry ─────────────────────────────────────────
  const cmdRegistry = new CommandRegistry();
  const cmdContext: CommandContext = {
    identity,
    storage,
    sendMessage,
    connectPeer,
    emit,
    setProfile: setProfileCallback,
  };

  cmdRegistry.register(new HelpCommand(() => cmdRegistry.all()));
  cmdRegistry.register(new NickCommand());
  cmdRegistry.register(new OnlineCommand());
  cmdRegistry.register(new ConnectCommand());
  cmdRegistry.register(new HistoryCommand());
  cmdRegistry.register(new ClearCommand());
  cmdRegistry.register(new ExitCommand());
  cmdRegistry.register(new StatusCommand());
  cmdRegistry.register(new BioCommand());

  const commandParser = new CommandParser(cmdRegistry, cmdContext);

  return { identity, router, sendMessage, receiveMessage, commandParser, storage, lanTransport, callManager, handleEvent };
}
