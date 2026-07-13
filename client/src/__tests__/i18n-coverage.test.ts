import { expect, test } from 'vitest';
import en from '../i18n/messages_en.json';
import he from '../i18n/messages_he.json';

test('Hebrew translation bundle contains all keys from English bundle', () => {
  const missing = Object.keys(en).filter((k) => !(k in he));
  const extra = Object.keys(he).filter((k) => !(k in en));
  expect(missing).toEqual([]);
  // optional: ensure no stray keys
  expect(extra).toEqual([]);
});
