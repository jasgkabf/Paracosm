'use client';

import { useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { translations, detectLocale, type Locale, type TranslationKeys } from '@/lib/i18n';

export function useLocale() {
  const { locale, setLocale } = useStore();

  useEffect(() => {
    const detected = detectLocale();
    if (locale !== detected) {
      setLocale(detected);
    }
  }, []);

  const t = useCallback(
    (key: keyof TranslationKeys): string => {
      return translations[locale as Locale]?.[key] ?? translations.en[key] ?? key;
    },
    [locale]
  );

  const changeLocale = useCallback(
    (newLocale: Locale) => {
      setLocale(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem('paracosm-locale', newLocale);
      }
    },
    [setLocale]
  );

  const getLocale = useCallback(() => locale, [locale]);

  return { t, setLocale: changeLocale, getLocale, locale };
}
