import React from 'react';
import { Box, Text } from 'ink';

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
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
      {messages.map(msg => (
        <MessageRow key={msg.id} msg={msg} />
      ))}
    </Box>
  );
}

function MessageRow({ msg }: { msg: ChatMessage }) {
  const ts = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (msg.isSystem) {
    return (
      <Box>
        <Text dimColor>[{ts}] </Text>
        <Text color="yellow" italic>{msg.text}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text dimColor>[{ts}] </Text>
      <Text color={msg.isOwn ? 'cyan' : 'magenta'} bold>{msg.sender}</Text>
      <Text>: {msg.text}</Text>
    </Box>
  );
}
