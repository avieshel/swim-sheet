// Simple i18n helper – loads the appropriate language bundle (fallback to English)
import en from './messages_en.json';

type Bundle = Record<string, string>;

const bundles: Record<string, Bundle> = { en };

// Determine language – only the first part (e.g., "en" from "en‑US")
const lang = (navigator.language || 'en').split('-')[0];
const messages: Bundle = bundles[lang] ?? bundles.en;

/**
 * Retrieve a localized string.
 * If the key is missing, the key itself is returned (so UI still shows something).
 */
export const t = (key: string): string => messages[key] ?? key;
