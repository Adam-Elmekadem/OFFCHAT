import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../ThemeContext.js';

export interface ChatMessage {
  id: string;
  timestamp: number;
  sender: string;
  text: string;
  isOwn: boolean;
  isSystem: boolean;
}

interface Props {
  messages: ChatMessage[];
}

export function ChatPane({ messages }: Props) {
  const t = useTheme();
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
      {messages.map(msg => (
        <MessageRow key={msg.id} msg={msg} />
      ))}
    </Box>
  );
}

function MessageRow({ msg }: { msg: ChatMessage }) {
  const t = useTheme();
  const ts = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (msg.isSystem) {
    return (
      <Box>
        <Text color={t.dim} dimColor={t.useDimColor}>[{ts}] </Text>
        <Text color={t.sysMsg} italic>{msg.text}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={t.dim} dimColor={t.useDimColor}>[{ts}] </Text>
      <Text color={msg.isOwn ? t.ownMsg : t.peerMsg} bold>{msg.sender}</Text>
      <Text color={t.text}>: {msg.text}</Text>
    </Box>
  );
}
