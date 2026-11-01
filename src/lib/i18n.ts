import { de } from "@/lib/messages/de";
import { en } from "@/lib/messages/en";
import { es } from "@/lib/messages/es";
import { fr } from "@/lib/messages/fr";
import { tr } from "@/lib/messages/tr";

export const LANGUAGES = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
  { id: "tr", label: "Türkçe" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
] as const;

export type Language = (typeof LANGUAGES)[number]["id"];

const MESSAGES: Record<Language, Record<string, string>> = { de, en, tr, es, fr };
const STORAGE_KEY = "synaptex.language";

function detectLanguage(): Language {
  const stored = (() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  const preferred = stored ?? navigator.language.slice(0, 2);
  return LANGUAGES.some(({ id }) => id === preferred) ? (preferred as Language) : "en";
}

export const language = typeof window === "undefined" ? "de" : detectLanguage();

// The page reloads on change, so components read the language once.
export function changeLanguage(next: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Without storage the choice cannot survive the reload.
  }
  window.location.reload();
}

// Unknown keys fall back to German, then to the key itself.
export function t(key: string, values: Record<string, string | number> = {}) {
  const text = MESSAGES[language][key] ?? de[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ""));
}
