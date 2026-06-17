import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  nickname: string;
  deviceId: string;
  peerCount: number;
  transport: string;
  unreadTotal?: number | undefined;
  activePeer?: string | undefined;
}

export function StatusBar({ nickname, deviceId, peerCount, transport, unreadTotal, activePeer }: Props) {
  const shortId = deviceId.slice(0, 8);
  return (
    <Box borderStyle="single" borderBottom={false} paddingX={1}>
      <Text bold color="greenBright">OFFCHAT</Text>
      <Text> │ </Text>
      <Text color="cyan">{nickname}</Text>
      <Text dimColor> [{shortId}]</Text>
      <Text> │ </Text>
      <Text color={peerCount > 0 ? 'green' : 'yellow'}>
        {peerCount} peer{peerCount !== 1 ? 's' : ''}
      </Text>
      {unreadTotal != null && unreadTotal > 0 && (
        <>
          <Text> │ </Text>
          <Text color="greenBright" bold>+{unreadTotal} unread</Text>
        </>
      )}
      {activePeer && (
        <>
          <Text> │ </Text>
          <Text color="magenta">→ {activePeer}</Text>
        </>
      )}
      <Text> │ </Text>
      <Text dimColor>{transport}</Text>
    </Box>
  );
}
