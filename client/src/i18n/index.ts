// Simple i18n helper – loads the appropriate language bundle (fallback to English)
import en from './messages_en.json';

type Bundle = Record<string, string>;

import he from './messages_he.json';

const bundles: Record<string, Bundle> = { en, he };

// Determine language – stored preference overrides navigator
const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedLanguage') : null;
const lang = (storedLang || (navigator.language || 'en')).split('-')[0];
const messages: Bundle = bundles[lang] ?? bundles.en;

/**
 * Retrieve a localized string.
 * If the key is missing, the key itself is returned (so UI still shows something).
 */
export const t = (key: string): string => messages[key] ?? key;
