import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../ThemeContext.js';

export type CallState = 'idle' | 'calling' | 'ringing' | 'active';

interface Props {
  state: CallState;
  peerNickname?: string | undefined;
  ptt: boolean;
}

export function CallBar({ state, peerNickname, ptt }: Props) {
  const t = useTheme();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== 'active') { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  if (state === 'idle') return null;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  let label: string;
  let color: string;
  if (state === 'calling') {
    label = `📞 Calling ${peerNickname ?? '…'}`;
    color = t.dotAway;
  } else if (state === 'ringing') {
    label = `📞 Incoming from ${peerNickname ?? '…'}  /accept  /reject`;
    color = t.dotBusy;
  } else {
    label = `🎙  ${peerNickname ?? '?'} ${mm}:${ss}  hold Ctrl+T to talk`;
    color = t.dotOnline;
  }

  return (
    <Box borderStyle="single" borderLeft={false} borderRight={false} borderTop={false} paddingX={1}>
      <Text color={color} bold>{label}</Text>
      {state === 'active' && ptt && <Text color={t.dotBusy} bold>  [MIC ON]</Text>}
    </Box>
  );
}
