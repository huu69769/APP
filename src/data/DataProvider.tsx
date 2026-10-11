import { getLocales } from 'expo-localization';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import i18n from '@/i18n';

import { demoFromQuery, prepareDemo } from './demo';
import { createRepositories, type Repositories } from './repository';
import { languageFromQuery, loadSettings, saveSettings, type Settings } from './settings';
import { createDefaultDriver } from './storage';
import type { DataDump, StorageDriver } from './storage/types';

interface DataContextValue {
  driver: StorageDriver;
  repos: Repositories;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** 用备份整体替换所有数据（导入备份） */
  replaceAllData: (dump: DataDump) => Promise<void>;
  /** 每次有数据写入就 +1，界面据此重新读取 */
  dataVersion: number;
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
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 网页版：网址带 ?lang=ja / ?lang=zh 时，第一次打开按它定默认设置，并用这个语言显示；
      // 带 ?demo=1 时用示例数据（作品集网站里嵌入时用）
      const search =
        Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.search : '';
      const urlLanguage = languageFromQuery(search);
      const demo = demoFromQuery(search);
      const driver = createDefaultDriver({ demo });
      await driver.init();
      const repos = createRepositories(driver, {
        newId: () => Crypto.randomUUID(),
        onChange: () => setDataVersion((v) => v + 1),
      });
      if (demo) {
        const language = urlLanguage ?? 'ja';
        await prepareDemo(driver, repos, { language, t: i18n.getFixedT(language) });
      }
      const loaded = await loadSettings(driver, urlLanguage ?? getLocales()[0]?.languageCode);
      const settings = urlLanguage ? { ...loaded, language: urlLanguage } : loaded;
      await i18n.changeLanguage(settings.language);
      if (!cancelled) setState({ status: 'ready', driver, repos, settings });
    })().catch((error: unknown) => {
      if (!cancelled) {
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
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

  const replaceAllData = useCallback(
    async (dump: DataDump) => {
      if (state.status !== 'ready') return;
      await state.driver.importAll(dump);
      const settings = await loadSettings(state.driver);
      await i18n.changeLanguage(settings.language);
      setState((s) => (s.status === 'ready' ? { ...s, settings } : s));
      setDataVersion((v) => v + 1);
    },
    [state]
  );

  if (state.status === 'loading') return fallback({});
  if (state.status === 'error') return fallback({ error: state.error });

  return (
    <DataContext.Provider
      value={{
        driver: state.driver,
        repos: state.repos,
        settings: state.settings,
        updateSettings,
        replaceAllData,
        dataVersion,
      }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}
