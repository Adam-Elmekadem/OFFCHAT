import { randomUUID } from 'node:crypto';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { ChatPane } from './components/ChatPane.js';
import { InputBar } from './components/InputBar.js';
import { PeerListPane } from './components/PeerListPane.js';
import { CallBar } from './components/CallBar.js';
import type { CallState } from './components/CallBar.js';
import { ThemeContext, useTheme } from './ThemeContext.js';
import { THEMES } from './theme.js';
import type { ThemeId } from './theme.js';
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

function SysLog({ messages }: { messages: ChatMessage[] }) {
  const t = useTheme();
  const recent = messages.slice(-6);
  if (!recent.length) return null;
  return (
    <Box flexDirection="column" paddingX={1} borderStyle="single" borderLeft={false} borderRight={false} borderBottom={false}>
      {recent.map(msg => {
        const ts = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <Box key={msg.id}>
            <Text color={t.dim} dimColor={t.useDimColor}>[{ts}] </Text>
            <Text color={t.sysMsg}>{msg.text}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function App({ nickname, deviceId, commandParser, sendMessage, receiveMessage, onEvent, onReady }: Props) {
  const { stdout } = useStdout();
  const [themeId, setThemeId] = useState<ThemeId>('default');
  const theme = THEMES[themeId] ?? THEMES['default']!;

  useEffect(() => {
    process.stdout.write(theme.bgAnsi ?? '\x1b[49m');
    return () => { process.stdout.write('\x1b[49m\x1b[0m'); };
  }, [theme.bgAnsi]);

  const [view, setView] = useState<View>('peers');
  const [input, setInput] = useState('');
  const [knownPeers, setKnownPeers] = useState<KnownPeer[]>([]);
  const [activePeer, setActivePeer] = useState<Contact | null>(null);
  const [messagesByPeer, setMessagesByPeer] = useState<Record<string, ChatMessage[]>>({ system: [] });
  const [callState, setCallState] = useState<CallState>('idle');
  const [callPeerNickname, setCallPeerNickname] = useState<string | undefined>(undefined);
  const [ptt, setPtt] = useState(false);

  const activePeerRef   = useRef<Contact | null>(null);
  const knownPeersRef   = useRef<KnownPeer[]>([]);
  activePeerRef.current = activePeer;
  knownPeersRef.current = knownPeers;

  const addMsg = useCallback((id: string, msg: ChatMessage) => {
    setMessagesByPeer(prev => ({
      ...prev,
      [id]: [...(prev[id] ?? []).slice(-500), msg],
    }));
  }, []);

  const addSystem = useCallback((text: string) => {
    addMsg('system', {
      id: randomUUID(), timestamp: Date.now(),
      sender: 'system', text, isOwn: false, isSystem: true,
    });
  }, [addMsg]);

  // Ctrl+T → push-to-talk press/release
  useInput((_input, key) => {
    if (key.escape && view === 'chat') {
      setView('peers');
      setInput('');
      return;
    }
    // Ctrl+T: keyName is 't' with ctrl modifier
    if (key.ctrl && _input === 't') {
      if (callState === 'active') {
        if (!ptt) {
          setPtt(true);
          onEvent({ type: 'call-ptt-start' });
        } else {
          setPtt(false);
          onEvent({ type: 'call-ptt-stop' });
        }
      }
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
          const trustState = (event.contact.trustState ?? 'unverified') as 'trusted' | 'unverified' | 'blocked';
          const trustHint = trustState === 'trusted' ? '' : '  /trust <n> or /block <n>';
          addSystem(`peer found: ${event.nickname} [${trustState}]${trustHint} — press [${prev.length + 1}] to chat`);
          return [...prev, {
            deviceId: event.deviceId,
            nickname: event.nickname,
            transport: event.transport,
            isOnline: true,
            unreadCount: 0,
            publicKey: event.contact.publicKey,
            status: (event.status ?? 'online') as 'online' | 'away' | 'busy',
            trustState,
            ...(event.bio != null ? { bio: event.bio } : {}),
          }];
        });
      }
      if (event.type === 'peer-updated') {
        setKnownPeers(prev => prev.map(p =>
          p.deviceId === event.deviceId
            ? { ...p, status: event.status as 'online' | 'away' | 'busy', ...(event.bio != null ? { bio: event.bio } : {}) }
            : p,
        ));
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
      if (event.type === 'peer-lost') {
        setKnownPeers(prev => {
          const peer = prev.find(p => p.deviceId === event.deviceId);
          if (peer?.isOnline) addSystem(`${peer.nickname} went offline`);
          return prev.map(p =>
            p.deviceId === event.deviceId ? { ...p, isOnline: false } : p,
          );
        });
      }
      // ── Trust events from container → UI ─────────────────────
      if (event.type === 'trust-changed') {
        setKnownPeers(prev => prev.map(p =>
          p.deviceId === event.deviceId ? { ...p, trustState: event.trustState } : p,
        ));
      }
      if (event.type === 'message-from-unverified') {
        addSystem(`⚠ message from unverified peer ${event.nickname} — /trust <n> to trust, /block <n> to block`);
      }
      // ── Call events from container → UI ──────────────────────
      if (event.type === 'call-state') {
        setCallState(event.state);
        setCallPeerNickname(event.peerNickname);
        if (event.state === 'idle') { setPtt(false); }
      }
      if (event.type === 'call-incoming') {
        setCallState('ringing');
        setCallPeerNickname(event.peerNickname);
        addSystem(`📞 Incoming call from ${event.peerNickname} — type /accept or /reject`);
      }
    });

    receiveMessage.onMessage((msg: DecodedMessage) => {
      const senderId = msg.envelope.senderDeviceId;
      const senderPeer = knownPeersRef.current.find(p => p.deviceId === senderId);
      const unverifiedTag = senderPeer?.trustState === 'unverified' ? '[UNVERIFIED] ' : '';
      const chatMsg: ChatMessage = {
        id: msg.envelope.envelopeId,
        timestamp: msg.envelope.timestampUtc,
        sender: msg.envelope.senderNickname,
        text: unverifiedTag + msg.text,
        isOwn: false,
        isSystem: false,
      };
      addMsg(senderId, chatMsg);

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
    const contact: Contact = {
      deviceId: peer.deviceId,
      nickname: peer.nickname,
      publicKey: peer.publicKey,
      signingPublicKey: peer.publicKey,
      trustState: 'unverified',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    setActivePeer(contact);
    activePeerRef.current = contact;
    setView('chat');
    setKnownPeers(prev => prev.map(p =>
      p.deviceId === peer.deviceId ? { ...p, unreadCount: 0 } : p,
    ));
    addSystem(`now chatting with ${peer.nickname} [${peer.isOnline ? 'online' : 'offline'}]`);
  }, [knownPeers, addSystem]);

  const handleSubmit = useCallback(async (line: string) => {
    setInput('');
    const trimmed = line.trim();
    if (!trimmed) return;

    if (view === 'peers' && /^\d+$/.test(trimmed)) {
      selectPeer(parseInt(trimmed, 10));
      return;
    }

    if (trimmed.startsWith('/')) {
      if (trimmed === '/back' || trimmed === '/b') { setView('peers'); return; }

      if (trimmed.startsWith('/theme')) {
        const arg = trimmed.slice(6).trim();
        if (!arg) {
          addSystem(`themes: ${Object.keys(THEMES).join(', ')}  — current: ${themeId}`);
        } else if (THEMES[arg]) {
          setThemeId(arg as ThemeId);
          addSystem(`theme switched to "${THEMES[arg]!.label}"`);
        } else {
          addSystem(`unknown theme "${arg}" — available: ${Object.keys(THEMES).join(', ')}`);
        }
        return;
      }

      // ── Call commands handled directly in UI ─────────────────
      if (trimmed.startsWith('/call')) {
        const arg = trimmed.slice(5).trim();
        const idx = parseInt(arg, 10);
        if (!arg || isNaN(idx)) {
          addSystem('usage: /call <peer number>');
          return;
        }
        const peer = knownPeers[idx - 1];
        if (!peer) { addSystem(`no peer [${idx}]`); return; }
        if (!peer.isOnline) { addSystem(`${peer.nickname} is offline`); return; }
        onEvent({ type: 'call-initiate', deviceId: peer.deviceId });
        return;
      }
      if (trimmed === '/accept') { onEvent({ type: 'call-accept' }); return; }
      if (trimmed === '/reject') { onEvent({ type: 'call-reject' }); return; }
      if (trimmed === '/hangup') { onEvent({ type: 'call-hangup' }); return; }

      // ── Trust commands handled directly in UI (need peer index) ─
      if (trimmed.startsWith('/trust') || trimmed.startsWith('/block')) {
        const isTrust = trimmed.startsWith('/trust');
        const arg = trimmed.slice(isTrust ? 6 : 6).trim();
        const idx = parseInt(arg, 10);
        if (!arg || isNaN(idx)) {
          addSystem(`usage: ${isTrust ? '/trust' : '/block'} <peer number>`);
          return;
        }
        const peer = knownPeers[idx - 1];
        if (!peer) { addSystem(`no peer [${idx}]`); return; }
        onEvent({ type: 'peer-trust', deviceId: peer.deviceId, trustState: isTrust ? 'trusted' : 'blocked' });
        return;
      }

      const result = await commandParser.parse(trimmed);
      if (result.output) addSystem(result.output);
      if (!result.error && trimmed.startsWith('/exit')) onEvent({ type: 'exit' });
      return;
    }

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
  }, [view, activePeer, addMsg, addSystem, commandParser, knownPeers, nickname, onEvent, selectPeer, sendMessage, themeId]);

  const totalUnread = knownPeers.reduce((n, p) => n + p.unreadCount, 0);

  const currentMessages = view === 'chat' && activePeer
    ? [...(messagesByPeer['system'] ?? []), ...(messagesByPeer[activePeer.deviceId] ?? [])]
    : (messagesByPeer['system'] ?? []);

  const prompt = view === 'chat' && activePeer ? activePeer.nickname : undefined;

  return (
    <ThemeContext.Provider value={theme}>
      <Box flexDirection="column" height={stdout.rows} width={stdout.columns}>
        <StatusBar
          nickname={nickname}
          deviceId={deviceId}
          peerCount={knownPeers.filter(p => p.isOnline).length}
          transport="LAN"
          unreadTotal={totalUnread}
          activePeer={view === 'chat' ? activePeer?.nickname : undefined}
        />
        {view === 'peers' ? (
          <>
            <PeerListPane peers={knownPeers} />
            <SysLog messages={messagesByPeer['system'] ?? []} />
          </>
        ) : (
          <ChatPane messages={currentMessages} />
        )}
        <CallBar state={callState} peerNickname={callPeerNickname} ptt={ptt} />
        <InputBar
          value={input}
          activePeer={prompt ?? null}
          onChange={setInput}
          onSubmit={handleSubmit}
          hint={view === 'peers' ? 'number or /command' : 'message · Esc · /theme'}
        />
      </Box>
    </ThemeContext.Provider>
  );
}
