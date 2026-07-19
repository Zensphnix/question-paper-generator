import { useState, useEffect, useMemo, useCallback } from "react";
import { translations } from "../i18n.js";
import LanguageContext from "./languageContextInstance.js";

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("uiLang") || "en");

  useEffect(() => {
    localStorage.setItem("uiLang", lang);
  }, [lang]);

  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations.en[key] ?? key,
    [lang]
  );

  const generationLanguage = lang === "hi" ? "Hindi" : "English";

  // Every component that calls useLanguage() re-renders whenever this value's
  // identity changes — without useMemo, that was EVERY render of the app root,
  // regardless of whether lang actually changed. Now it only changes when lang
  // (and therefore t/generationLanguage, which are derived from it) actually does.
  const value = useMemo(
    () => ({ lang, setLang, t, generationLanguage }),
    [lang, setLang, t, generationLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
