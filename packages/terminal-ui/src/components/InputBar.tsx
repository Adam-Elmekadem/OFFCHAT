import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useTheme } from '../ThemeContext.js';

interface Props {
  value: string;
  activePeer: string | null;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  hint?: string;
}

export function InputBar({ value, activePeer, onChange, onSubmit, hint }: Props) {
  const t = useTheme();
  const promptLabel = activePeer ? `→ ${activePeer}` : 'OFFCHAT';
  return (
    <Box borderStyle="single" borderTop={false} paddingX={1}>
      <Text color={t.prompt} bold>{promptLabel}</Text>
      <Text color={t.dim}> › </Text>
      <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
      {hint && <Text color={t.dim} dimColor={t.useDimColor}>  [{hint}]</Text>}
    </Box>
  );
}
