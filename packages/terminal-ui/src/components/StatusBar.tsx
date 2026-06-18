import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../ThemeContext.js';

interface Props {
  nickname: string;
  deviceId: string;
  peerCount: number;
  transport: string;
  unreadTotal?: number | undefined;
  activePeer?: string | undefined;
}

export function StatusBar({ nickname, deviceId, peerCount, transport, unreadTotal, activePeer }: Props) {
  const t = useTheme();
  const shortId = deviceId.slice(0, 8);
  return (
    <Box borderStyle="single" borderBottom={false} paddingX={1}>
      <Text bold color={t.accent}>OFFCHAT</Text>
      <Text color={t.dim}> │ </Text>
      <Text color={t.prompt}>{nickname}</Text>
      <Text color={t.dim}> [{shortId}]</Text>
      <Text color={t.dim}> │ </Text>
      <Text color={peerCount > 0 ? t.dotOnline : t.sysMsg}>
        {peerCount} peer{peerCount !== 1 ? 's' : ''}
      </Text>
      {unreadTotal != null && unreadTotal > 0 && (
        <>
          <Text color={t.dim}> │ </Text>
          <Text color={t.unread} bold>+{unreadTotal} unread</Text>
        </>
      )}
      {activePeer && (
        <>
          <Text color={t.dim}> │ </Text>
          <Text color={t.peerMsg}>→ {activePeer}</Text>
        </>
      )}
      <Text color={t.dim}> │ </Text>
      <Text color={t.dim}>{transport}</Text>
    </Box>
  );
}
