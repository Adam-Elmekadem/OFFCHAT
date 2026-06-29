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
  status?: 'online' | 'away' | 'busy' | undefined;
  bio?: string | undefined;
  trustState?: 'trusted' | 'unverified' | 'blocked' | undefined;
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
        <Text color={t.dim} dimColor={t.useDimColor}>
          number to chat  ·  /trust &lt;n&gt;  /block &lt;n&gt;  /contacts  ·  /help
        </Text>
      </Box>
    </Box>
  );
}

function trustBadge(trustState: KnownPeer['trustState']): { label: string; color: string } {
  if (trustState === 'trusted')  return { label: '[T]', color: 'green' };
  if (trustState === 'blocked')  return { label: '[X]', color: 'red' };
  return { label: '[?]', color: 'yellow' };
}

function PeerRow({ index, peer }: { index: number; peer: KnownPeer }) {
  const t = useTheme();

  let dot: string;
  let dotColor: string;
  if (!peer.isOnline) {
    dot = '○';
    dotColor = t.dotOffline;
  } else {
    switch (peer.status) {
      case 'away': dot = '◐'; dotColor = t.dotAway; break;
      case 'busy': dot = '◉'; dotColor = t.dotBusy; break;
      default:     dot = '●'; dotColor = t.dotOnline; break;
    }
  }

  const badge = trustBadge(peer.trustState);

  const ts = peer.lastMessageAt
    ? new Date(peer.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={t.numKey} bold>[{index}]</Text>
        <Text>  </Text>
        <Text color={dotColor}>{dot} </Text>
        <Text bold color={t.heading}>{peer.nickname.padEnd(14)}</Text>
        <Text color={badge.color}>{badge.label}</Text>
        <Text color={t.dim} dimColor={t.useDimColor}>  {peer.transport}</Text>
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
      {peer.bio != null && peer.bio !== '' && (
        <Box paddingLeft={7}>
          <Text color={t.dim} dimColor={t.useDimColor}>{peer.bio}</Text>
        </Box>
      )}
    </Box>
  );
}
