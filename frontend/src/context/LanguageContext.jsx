import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../i18n.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("uiLang") || "en");

  useEffect(() => {
    localStorage.setItem("uiLang", lang);
  }, [lang]);

  function setLang(newLang) {
    setLangState(newLang);
  }

  function t(key) {
    return translations[lang]?.[key] ?? translations.en[key] ?? key;
  }

  // "AI generation language" — full language name, sent straight into the AI prompt
  const generationLanguage = lang === "hi" ? "Hindi" : "English";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, generationLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
