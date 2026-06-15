import { randomUUID } from 'node:crypto';
import React, { useState, useCallback, useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { ChatPane } from './components/ChatPane.js';
import { InputBar } from './components/InputBar.js';
import type { ChatMessage } from './components/ChatPane.js';
import type { CommandParser } from '@offchat/command-engine';
import type { AppEvent } from '@offchat/command-engine';
import type { SendMessage } from '@offchat/application';
import type { DecodedMessage } from '@offchat/application';
import type { ReceiveMessage } from '@offchat/application';
import type { Contact } from '@offchat/domain';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activePeer, setActivePeer] = useState<Contact | null>(null);
  const [peerCount, setPeerCount] = useState(0);

  const addSystem = useCallback((text: string) => {
    setMessages(prev => [...prev.slice(-500), {
      id: randomUUID(),
      timestamp: Date.now(),
      sender: 'system',
      text,
      isOwn: false,
      isSystem: true,
    }]);
  }, []);

  useEffect(() => {
    addSystem('OFFCHAT started. Type /help for commands.');

    // Register this App instance as the inbound event receiver
    onReady((event: AppEvent) => {
      if (event.type === 'system-message') {
        addSystem(event.text);
        if (event.text.startsWith('peer found:')) {
          setPeerCount(p => p + 1);
        }
      }
      if (event.type === 'peer-connected') {
        setActivePeer(event.contact);
        addSystem(`connected to ${event.contact.nickname} [${event.contact.trustState}]`);
      }
      if (event.type === 'nick-changed') {
        addSystem(`nickname changed to ${event.nickname}`);
      }
    });

    receiveMessage.onMessage((msg: DecodedMessage) => {
      setMessages(prev => [...prev.slice(-500), {
        id: msg.envelope.envelopeId,
        timestamp: msg.envelope.timestampUtc,
        sender: msg.envelope.senderNickname,
        text: msg.text,
        isOwn: false,
        isSystem: false,
      }]);
    });
  }, [addSystem, onReady, receiveMessage]);

  const handleSubmit = useCallback(async (line: string) => {
    setInput('');
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      const result = await commandParser.parse(trimmed);
      if (result.output) addSystem(result.output);
      if (result.error === false && trimmed.startsWith('/exit')) onEvent({ type: 'exit' });
      return;
    }

    if (!activePeer || !sendMessage) {
      addSystem('no active peer — use /connect <device-id> first, or /online to list peers');
      return;
    }

    setMessages(prev => [...prev.slice(-500), {
      id: randomUUID(),
      timestamp: Date.now(),
      sender: nickname,
      text: trimmed,
      isOwn: true,
      isSystem: false,
    }]);

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
  }, [activePeer, addSystem, commandParser, nickname, onEvent, sendMessage]);

  return (
    <Box flexDirection="column" height={stdout.rows}>
      <StatusBar
        nickname={nickname}
        deviceId={deviceId}
        peerCount={peerCount}
        transport="LAN"
      />
      <ChatPane messages={messages} />
      <InputBar
        value={input}
        activePeer={activePeer?.nickname ?? null}
        onChange={setInput}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
