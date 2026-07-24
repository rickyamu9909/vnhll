"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Locale = "zh" | "vi";

type I18nContextValue = {
  locale: Locale;
  dict: Record<string, string>;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
  loading: boolean;
  reload: () => Promise<void>;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const LOCALE_KEY = "ants_locale";

function readInitialLocale(fallback: Locale): Locale {
  if (typeof window === "undefined") return fallback;
  const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
  return saved === "zh" || saved === "vi" ? saved : fallback;
}

function readCachedDict(locale: Locale): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`ants_i18n_${locale}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children, initialLocale = "zh" }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => readInitialLocale(initialLocale));
  const [dict, setDict] = useState<Record<string, string>>(() => readCachedDict(readInitialLocale(initialLocale)) || {});
  const [loading, setLoading] = useState(() => !readCachedDict(readInitialLocale(initialLocale)));

  const reload = useCallback(async () => {
    const cached = readCachedDict(locale);
    if (!cached) setLoading(true);
    try {
      const res = await fetch(`/api/i18n?locale=${locale}`, { cache: "force-cache" });
      const json = await res.json();
      if (json.ok) {
        const nextDict = json.data.dict || {};
        setDict(nextDict);
        try {
          sessionStorage.setItem(`ants_i18n_${locale}`, JSON.stringify(nextDict));
        } catch {
          /* ignore quota */
        }
      }
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem(LOCALE_KEY, l);
  };

  const value = useMemo(
    () => ({
      locale,
      dict,
      setLocale,
      loading,
      reload,
      t: (key: string, fallback?: string) => dict[key] || fallback || key,
    }),
    [locale, dict, loading, reload]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
