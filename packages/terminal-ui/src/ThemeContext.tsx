import React, { createContext, useContext } from 'react';
import { THEMES } from './theme.js';
import type { Theme } from './theme.js';

export const ThemeContext = createContext<Theme>(THEMES['default']!);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
