export interface Theme {
  id: 'default' | 'old-blue';
  label: string;
  bg?: string | undefined;
  bgAnsi?: string | undefined;
  accent: string;
  heading: string;
  text: string;
  dim: string;
  useDimColor: boolean;
  ownMsg: string;
  peerMsg: string;
  sysMsg: string;
  prompt: string;
  numKey: string;
  dotOnline: string;
  dotAway: string;
  dotBusy: string;
  dotOffline: string;
  unread: string;
  border: string;
}

export const THEMES: Record<string, Theme> = {
  default: {
    id: 'default',
    label: 'Default (green)',
    bg: undefined,
    bgAnsi: '\x1b[49m',
    accent: 'greenBright',
    heading: 'white',
    text: 'white',
    dim: 'gray',
    useDimColor: true,
    ownMsg: 'cyan',
    peerMsg: 'magenta',
    sysMsg: 'yellow',
    prompt: 'greenBright',
    numKey: 'yellow',
    dotOnline: 'green',
    dotAway: 'yellow',
    dotBusy: 'red',
    dotOffline: 'gray',
    unread: 'greenBright',
    border: 'gray',
  },
  'old-blue': {
    id: 'old-blue',
    label: 'Old Blue (classic)',
    bg: 'blue',
    bgAnsi: '\x1b[44m',
    accent: 'yellowBright',
    heading: 'whiteBright',
    text: 'white',
    dim: 'white',
    useDimColor: false,
    ownMsg: 'whiteBright',
    peerMsg: 'cyanBright',
    sysMsg: 'yellowBright',
    prompt: 'yellowBright',
    numKey: 'whiteBright',
    dotOnline: 'greenBright',
    dotAway: 'yellowBright',
    dotBusy: 'redBright',
    dotOffline: 'white',
    unread: 'yellowBright',
    border: 'white',
  },
};

export type ThemeId = keyof typeof THEMES;
