import ja from '../locales/ja.json';
import zh from '../locales/zh.json';

function shape(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe('locale files', () => {
  it('ja has exactly the same keys as zh', () => {
    expect(shape(ja).sort()).toEqual(shape(zh).sort());
  });
});
