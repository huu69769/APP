import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import type { ThemeMode } from '@/data/settings';

import { darkColors, lightColors, type Palette } from './colors';

export { JOB_COLORS, type Palette } from './colors';

const ThemeContext = createContext<Palette>(lightColors);

/** 当前配色：设置里选的浅色 / 深色，或跟随系统 */
export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return (
    <ThemeContext.Provider value={dark ? darkColors : lightColors}>
      {children}
    </ThemeContext.Provider>
  );
}

/** 组件里取颜色 */
export function useColors(): Palette {
  return useContext(ThemeContext);
}

export function useIsDark(): boolean {
  return useColors() === darkColors;
}

/**
 * 按当前配色生成样式。用法：
 *   const useStyles = makeStyles((colors) => ({ box: { backgroundColor: colors.surface } }));
 *   组件里：const styles = useStyles();
 * 每套配色只生成一次。
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  create: (colors: Palette) => T & StyleSheet.NamedStyles<T>
): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const colors = useColors();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(create(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}
