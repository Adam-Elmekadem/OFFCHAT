import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  nickname: string;
  deviceId: string;
  peerCount: number;
  transport: string;
}

export function StatusBar({ nickname, deviceId, peerCount, transport }: Props) {
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
      <Text> │ </Text>
      <Text dimColor>{transport}</Text>
    </Box>
  );
}
