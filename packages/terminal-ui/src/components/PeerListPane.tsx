import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../ThemeContext.js';

export interface KnownPeer {
  deviceId: string;
  nickname: string;
  transport: string;
  isOnline: boolean;
  unreadCount: number;
  publicKey: Uint8Array;
  lastMessage?: string;
  lastMessageAt?: number;
}

interface Props {
  peers: KnownPeer[];
}

export function PeerListPane({ peers }: Props) {
  const t = useTheme();

  if (peers.length === 0) {
    return (
      <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
        <Text color={t.accent}>scanning for peers...</Text>
        <Text color={t.dim} dimColor={t.useDimColor}>Make sure both devices are on the same network.</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1} gap={0}>
      <Box marginBottom={1}>
        <Text color={t.accent} bold>● </Text>
        <Text color={t.heading} bold>Peers nearby</Text>
      </Box>
      {peers.map((peer, i) => (
        <PeerRow key={peer.deviceId} index={i + 1} peer={peer} />
      ))}
      <Box marginTop={1}>
        <Text color={t.dim} dimColor={t.useDimColor}>type a number to chat  ·  /help for commands  ·  /theme old-blue to switch theme</Text>
      </Box>
    </Box>
  );
}

function PeerRow({ index, peer }: { index: number; peer: KnownPeer }) {
  const t = useTheme();
  const dot = peer.isOnline ? '●' : '○';
  const dotColor = peer.isOnline ? t.dotOnline : t.dotOffline;
  const ts = peer.lastMessageAt
    ? new Date(peer.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Box marginBottom={1}>
      <Text color={t.numKey} bold>[{index}]</Text>
      <Text>  </Text>
      <Text color={dotColor}>{dot} </Text>
      <Text bold color={t.heading}>{peer.nickname.padEnd(14)}</Text>
      <Text color={t.dim} dimColor={t.useDimColor}>{peer.transport}</Text>
      {peer.unreadCount > 0 && (
        <Text color={t.unread} bold>  +{peer.unreadCount} new</Text>
      )}
      {peer.lastMessage != null && (
        <Text color={t.dim} dimColor={t.useDimColor}>
          {'  '}"{peer.lastMessage.slice(0, 28)}{peer.lastMessage.length > 28 ? '…' : '"'}
          {ts ? `  ${ts}` : ''}
        </Text>
      )}
    </Box>
  );
}
