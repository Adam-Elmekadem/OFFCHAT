import { randomUUID } from 'node:crypto';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, useStdout, useInput } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { ChatPane } from './components/ChatPane.js';
import { InputBar } from './components/InputBar.js';
import { PeerListPane } from './components/PeerListPane.js';
import type { KnownPeer } from './components/PeerListPane.js';
import type { ChatMessage } from './components/ChatPane.js';
import type { CommandParser } from '@offchat/command-engine';
import type { AppEvent } from '@offchat/command-engine';
import type { SendMessage } from '@offchat/application';
import type { DecodedMessage } from '@offchat/application';
import type { ReceiveMessage } from '@offchat/application';
import type { Contact } from '@offchat/domain';

type View = 'peers' | 'chat';

interface Props {
  nickname: string;
  deviceId: string;
  commandParser: CommandParser;
  sendMessage: SendMessage | null;
  receiveMessage: ReceiveMessage;
  onEvent: (e: AppEvent) => void;
  onReady: (inbound: (e: AppEvent) => void) => void;
}

export function App({ nickname, deviceId, commandParser, sendMessage, receiveMessage, onEvent, onReady }: Props) {
  const { stdout } = useStdout();
  const [view, setView] = useState<View>('peers');
  const [input, setInput] = useState('');
  const [knownPeers, setKnownPeers] = useState<KnownPeer[]>([]);
  const [activePeer, setActivePeer] = useState<Contact | null>(null);
  // messages keyed by deviceId; 'system' for global system messages
  const [messagesByPeer, setMessagesByPeer] = useState<Record<string, ChatMessage[]>>({ system: [] });
  const activePeerRef = useRef<Contact | null>(null);
  activePeerRef.current = activePeer;

  const addMsg = useCallback((deviceId: string, msg: ChatMessage) => {
    setMessagesByPeer(prev => ({
      ...prev,
      [deviceId]: [...(prev[deviceId] ?? []).slice(-500), msg],
    }));
  }, []);

  const addSystem = useCallback((text: string) => {
    addMsg('system', {
      id: randomUUID(), timestamp: Date.now(),
      sender: 'system', text, isOwn: false, isSystem: true,
    });
  }, [addMsg]);

  // Esc → go back to peer list
  useInput((_input, key) => {
    if (key.escape && view === 'chat') {
      setView('peers');
      setInput('');
    }
  });

  useEffect(() => {
    addSystem('OFFCHAT started. Type /help for commands.');

    onReady((event: AppEvent) => {
      if (event.type === 'system-message') {
        addSystem(event.text);
      }
      if (event.type === 'peer-found') {
        setKnownPeers(prev => {
          if (prev.some(p => p.deviceId === event.deviceId)) return prev;
          addSystem(`peer found: ${event.nickname} — press [${prev.length + 1}] to chat`);
          return [...prev, {
            deviceId: event.deviceId,
            nickname: event.nickname,
            transport: event.transport,
            isOnline: true,
            unreadCount: 0,
          }];
        });
      }
      if (event.type === 'peer-connected') {
        setActivePeer(event.contact);
        activePeerRef.current = event.contact;
        setView('chat');
        addSystem(`connected to ${event.contact.nickname} [${event.contact.trustState}]`);
      }
      if (event.type === 'nick-changed') {
        addSystem(`nickname changed to ${event.nickname}`);
      }
    });

    receiveMessage.onMessage((msg: DecodedMessage) => {
      const senderId = msg.envelope.senderDeviceId;
      const chatMsg: ChatMessage = {
        id: msg.envelope.envelopeId,
        timestamp: msg.envelope.timestampUtc,
        sender: msg.envelope.senderNickname,
        text: msg.text,
        isOwn: false,
        isSystem: false,
      };
      addMsg(senderId, chatMsg);

      // If not currently chatting with this peer, increment unread count
      if (activePeerRef.current?.deviceId !== senderId) {
        setKnownPeers(prev => prev.map(p =>
          p.deviceId === senderId
            ? { ...p, unreadCount: p.unreadCount + 1, lastMessage: msg.text, lastMessageAt: msg.envelope.timestampUtc }
            : p,
        ));
      }
    });
  }, [addMsg, addSystem, onReady, receiveMessage]);

  const selectPeer = useCallback((index: number) => {
    const peer = knownPeers[index - 1];
    if (!peer) { addSystem(`no peer [${index}] — type /online to see who's here`); return; }
    const contact = (peer as KnownPeer & { _contact?: Contact })._contact
      ?? { deviceId: peer.deviceId, nickname: peer.nickname, publicKey: new Uint8Array(0),
           signingPublicKey: new Uint8Array(0), trustState: 'unverified' as const,
           firstSeenAt: Date.now(), lastSeenAt: Date.now() };
    setActivePeer(contact);
    activePeerRef.current = contact;
    setView('chat');
    // Clear unread count for this peer
    setKnownPeers(prev => prev.map(p =>
      p.deviceId === peer.deviceId ? { ...p, unreadCount: 0 } : p,
    ));
    addSystem(`now chatting with ${peer.nickname} [${peer.isOnline ? 'online' : 'offline'}]`);
  }, [knownPeers, addSystem]);

  const handleSubmit = useCallback(async (line: string) => {
    setInput('');
    const trimmed = line.trim();
    if (!trimmed) return;

    // In peer list view, a bare number selects a peer
    if (view === 'peers' && /^\d+$/.test(trimmed)) {
      selectPeer(parseInt(trimmed, 10));
      return;
    }

    if (trimmed.startsWith('/')) {
      // /back goes to peer list from anywhere
      if (trimmed === '/back' || trimmed === '/b') { setView('peers'); return; }
      const result = await commandParser.parse(trimmed);
      if (result.output) addSystem(result.output);
      if (!result.error && trimmed.startsWith('/exit')) onEvent({ type: 'exit' });
      return;
    }

    // Bare number in chat view → switch peer
    if (view === 'chat' && /^\d+$/.test(trimmed)) {
      selectPeer(parseInt(trimmed, 10));
      return;
    }

    if (!activePeer || !sendMessage) {
      addSystem('no active peer — type a number to select one, or /online to list peers');
      return;
    }

    addMsg(activePeer.deviceId, {
      id: randomUUID(), timestamp: Date.now(),
      sender: nickname, text: trimmed, isOwn: true, isSystem: false,
    });

    try {
      await sendMessage.execute({
        text: trimmed,
        recipientDeviceId: activePeer.deviceId,
        recipientPublicKey: activePeer.publicKey,
        chatScope: 'dm',
      });
    } catch (err) {
      addSystem(`send failed: ${String(err)}`);
    }
  }, [view, activePeer, addMsg, addSystem, commandParser, nickname, onEvent, selectPeer, sendMessage]);

  const totalUnread = knownPeers.reduce((n, p) => n + p.unreadCount, 0);

  const currentMessages = view === 'chat' && activePeer
    ? [...(messagesByPeer['system'] ?? []), ...(messagesByPeer[activePeer.deviceId] ?? [])]
    : (messagesByPeer['system'] ?? []);

  const prompt = view === 'chat' && activePeer ? activePeer.nickname : undefined;

  return (
    <Box flexDirection="column" height={stdout.rows}>
      <StatusBar
        nickname={nickname}
        deviceId={deviceId}
        peerCount={knownPeers.filter(p => p.isOnline).length}
        transport="LAN"
        unreadTotal={totalUnread}
        activePeer={view === 'chat' ? activePeer?.nickname : undefined}
      />
      {view === 'peers'
        ? <PeerListPane peers={knownPeers} />
        : <ChatPane messages={currentMessages} />
      }
      <InputBar
        value={input}
        activePeer={prompt ?? null}
        onChange={setInput}
        onSubmit={handleSubmit}
        hint={view === 'peers' ? 'number or /command' : 'message · Esc to go back'}
      />
    </Box>
  );
}
