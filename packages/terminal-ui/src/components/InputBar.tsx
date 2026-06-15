import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  value: string;
  activePeer: string | null;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
}

export function InputBar({ value, activePeer, onChange, onSubmit }: Props) {
  const prompt = activePeer ? `→ ${activePeer}` : 'OFFCHAT';
  return (
    <Box borderStyle="single" borderTop={false} paddingX={1}>
      <Text color="greenBright" bold>{prompt}</Text>
      <Text> › </Text>
      <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
    </Box>
  );
}
