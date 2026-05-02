import { useCallback } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { translations } from './translations';

export const LOCALE_FOR_LANGUAGE = {
  en: 'en-GB',
  es: 'es-ES',
};

const SUPPORTED = ['en', 'es'];

export function resolveLanguage(language) {
  return SUPPORTED.includes(language) ? language : 'en';
}

function lookup(catalog, key) {
  if (!catalog) return undefined;
  const parts = key.split('.');
  let cursor = catalog;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function useTranslation() {
  const language = useFinanceStore((state) => resolveLanguage(state.settings?.language));
  const locale = LOCALE_FOR_LANGUAGE[language] || 'en-GB';

  const t = useCallback(
    (key, vars) => {
      const primary = lookup(translations[language], key);
      if (primary != null) return interpolate(primary, vars);
      const fallback = lookup(translations.en, key);
      if (fallback != null) return interpolate(fallback, vars);
      if (import.meta.env?.DEV) {
        console.warn(`[i18n] missing key: ${key}`);
      }
      return key;
    },
    [language],
  );

  return { t, language, locale };
}
