import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import i18n from '@/i18n';

import { createRepositories, type Repositories } from './repository';
import { loadSettings, saveSettings, type Settings } from './settings';
import { createDefaultDriver } from './storage';
import type { StorageDriver } from './storage/types';

interface DataContextValue {
  driver: StorageDriver;
  repos: Repositories;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; driver: StorageDriver; repos: Repositories; settings: Settings };

/**
 * 打开数据库、读取设置，然后把 repository 提供给整个 app。
 * 界面里用 useData() 拿到 repos 和 settings。
 */
export function DataProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: (state: { error?: Error }) => ReactNode;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const driver = createDefaultDriver();
      await driver.init();
      const settings = await loadSettings(driver);
      const repos = createRepositories(driver, { newId: () => Crypto.randomUUID() });
      await i18n.changeLanguage(settings.language);
      if (!cancelled) setState({ status: 'ready', driver, repos, settings });
    })().catch((error: unknown) => {
      if (!cancelled) {
        setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (state.status !== 'ready') return;
      await saveSettings(state.driver, patch);
      if (patch.language) await i18n.changeLanguage(patch.language);
      setState((s) => (s.status === 'ready' ? { ...s, settings: { ...s.settings, ...patch } } : s));
    },
    [state]
  );

  if (state.status === 'loading') return fallback({});
  if (state.status === 'error') return fallback({ error: state.error });

  return (
    <DataContext.Provider
      value={{ driver: state.driver, repos: state.repos, settings: state.settings, updateSettings }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}
