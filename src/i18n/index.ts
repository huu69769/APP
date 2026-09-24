import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ja from './locales/ja.json';
import zh from './locales/zh.json';

/**
 * 多语言：界面上的文字全部放在 locales/*.json 里，代码里不写死文字。
 * 以后加 English：新建 locales/en.json，在下面的 resources 里加一行即可。
 */
export const resources = {
  zh: { translation: zh },
  ja: { translation: ja },
} as const;

export type AppLanguage = keyof typeof resources;
export const DEFAULT_LANGUAGE: AppLanguage = 'zh';

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
