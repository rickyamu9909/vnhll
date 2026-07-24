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

export function I18nProvider({ children, initialLocale = "zh" }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dict, setDict] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/i18n?locale=${locale}`);
      const json = await res.json();
      if (json.ok) setDict(json.data.dict || {});
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem("ynhll_locale", l);
  };

  useEffect(() => {
    const saved = localStorage.getItem("ynhll_locale") as Locale | null;
    if (saved === "zh" || saved === "vi") setLocaleState(saved);
  }, []);

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
