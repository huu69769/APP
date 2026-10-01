import { languageFromQuery, loadSettings } from '../settings';
import { MemoryDriver } from '../storage/memoryDriver';

describe('languageFromQuery', () => {
  it('reads ja / zh from the query string', () => {
    expect(languageFromQuery('?lang=ja')).toBe('ja');
    expect(languageFromQuery('?lang=zh')).toBe('zh');
    expect(languageFromQuery('?foo=1&lang=JA')).toBe('ja');
    expect(languageFromQuery('?lang=ja#top')).toBe('ja');
  });

  it('ignores missing or unknown values', () => {
    expect(languageFromQuery('')).toBeNull();
    expect(languageFromQuery(null)).toBeNull();
    expect(languageFromQuery(undefined)).toBeNull();
    expect(languageFromQuery('?lang=en')).toBeNull();
    expect(languageFromQuery('?language=ja')).toBeNull();
    expect(languageFromQuery('?slang=ja')).toBeNull();
  });

  it('gives Japanese defaults on first launch when passed to loadSettings', async () => {
    const settings = await loadSettings(new MemoryDriver(), languageFromQuery('?lang=ja'));
    expect(settings.language).toBe('ja');
    expect(settings.holidayMode).toBe('jp');
    expect(settings.defaultCurrency).toBe('JPY');
  });
});
