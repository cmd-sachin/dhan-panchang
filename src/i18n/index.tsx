import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { STRINGS, type StringKey } from "./strings";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

type Params = Record<string, string | number>;

interface I18nCtx {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: StringKey, params?: Params) => string;
}

const Ctx = createContext<I18nCtx | null>(null);
const LS_KEY = "dp.lang";

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    const saved = localStorage.getItem(LS_KEY) as LangCode | null;
    return saved && LANGUAGES.some((l) => l.code === saved) ? saved : "en";
  });

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    localStorage.setItem(LS_KEY, l);
  }, []);

  const t = useCallback(
    (key: StringKey, params?: Params) => {
      // Fallback chain: requested language → English → the raw key.
      const table = STRINGS[lang] as Partial<Record<StringKey, string>>;
      const raw = table[key] ?? STRINGS.en[key] ?? key;
      return interpolate(raw, params);
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
