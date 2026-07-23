"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Multilingual nurse-facing strings.
 *
 * The deployment target this project argues for is an Indian ICU, where the staff
 * reading a bedside verdict may not read English. Only the *nurse-facing* vocabulary is
 * translated — the decision, what it means, and the ward counters. Research prose stays
 * in English; pretending to localise a paper would be theatre.
 *
 * These translations are for demonstration and would need clinical review before any
 * real deployment. That caveat is shown in the UI.
 */

export type Lang = "en" | "hi" | "ta";

export const LANGS: Array<{ id: Lang; label: string; native: string }> = [
  { id: "en", label: "English", native: "English" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
  { id: "ta", label: "Tamil", native: "தமிழ்" },
];

const DICT = {
  // decisions — the words that actually matter at the bedside
  suppress: { en: "SILENCE", hi: "शांत करें", ta: "அமைதியாக்கு" },
  keep: { en: "ALERT NURSE", hi: "नर्स को सूचित करें", ta: "செவிலியருக்குத் தெரிவி" },
  defer: { en: "NEEDS REVIEW", hi: "समीक्षा आवश्यक", ta: "மறுஆய்வு தேவை" },

  suppress_sub: {
    en: "confident false alarm — silenced",
    hi: "निश्चित रूप से गलत अलार्म — शांत किया गया",
    ta: "உறுதியான தவறான அலாரம் — அமைதியாக்கப்பட்டது",
  },
  keep_sub: {
    en: "likely real — reaches the nurse",
    hi: "संभवतः वास्तविक — नर्स तक पहुँचेगा",
    ta: "உண்மையாக இருக்கலாம் — செவிலியரை அடையும்",
  },
  defer_sub: {
    en: "uncertain — routed to a human",
    hi: "अनिश्चित — मानव समीक्षा हेतु भेजा गया",
    ta: "நிச்சயமற்றது — மனித ஆய்வுக்கு அனுப்பப்பட்டது",
  },

  // bedside / ward vocabulary
  confidence: { en: "confidence", hi: "विश्वास", ta: "நம்பிக்கை" },
  bed: { en: "Bed", hi: "बेड", ta: "படுக்கை" },
  monitoring: { en: "monitoring", hi: "निगरानी", ta: "கண்காணிப்பு" },
  analysing: { en: "analysing", hi: "विश्लेषण", ta: "பகுப்பாய்வு" },
  resolved: { en: "resolved", hi: "निपटाया गया", ta: "தீர்க்கப்பட்டது" },
  alarms_fired: { en: "alarms fired", hi: "अलार्म बजे", ta: "அலாரங்கள் ஒலித்தன" },
  silenced: { en: "silenced", hi: "शांत किए गए", ta: "அமைதியாக்கப்பட்டவை" },
  reached_nurse: { en: "reached the nurse", hi: "नर्स तक पहुँचे", ta: "செவிலியரை அடைந்தவை" },
  deferred: { en: "deferred", hi: "स्थगित", ta: "ஒத்திவைக்கப்பட்டவை" },
  missed_real: {
    en: "real alarms missed",
    hi: "छूटे वास्तविक अलार्म",
    ta: "தவறவிட்ட உண்மையான அலாரங்கள்",
  },
  noise_reduction: { en: "noise reduction", hi: "शोर में कमी", ta: "இரைச்சல் குறைப்பு" },
  was_real: { en: "was real", hi: "वास्तविक था", ta: "உண்மையானது" },
  was_false: { en: "was false", hi: "गलत था", ta: "தவறானது" },

  translation_note: {
    en: "Nurse-facing labels only. Demonstration translations — clinical review required before real use.",
    hi: "केवल नर्स-संबंधी लेबल। प्रदर्शन हेतु अनुवाद — वास्तविक उपयोग से पहले चिकित्सकीय समीक्षा आवश्यक।",
    ta: "செவிலியர் பயன்பாட்டு சொற்கள் மட்டும். செயல்விளக்க மொழிபெயர்ப்பு — உண்மையான பயன்பாட்டிற்கு முன் மருத்துவ ஆய்வு தேவை.",
  },
} as const;

export type Key = keyof typeof DICT;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}

const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => DICT[k].en });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("sg-lang") as Lang | null;
    if (saved && LANGS.some((l) => l.id === saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("sg-lang", l);
  };

  const t = (k: Key) => DICT[k][lang] ?? DICT[k].en;
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

/** Decision label + subtitle in the active language, keyed by the engine's decision. */
export function useDecisionText() {
  const { t } = useLang();
  return (d: "suppress" | "keep" | "defer") => ({
    label: t(d),
    sub: t(`${d}_sub` as Key),
  });
}
