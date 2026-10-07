import { create } from 'zustand'
import type { Lang } from '@/types'
import { translations, type TranslationKey } from './translations'

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

const applyDir = (lang: Lang) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', lang)
  }
}

export const useLangStore = create<LangState>()((set, get) => ({
  lang: 'fr',
  setLang: (lang) => {
    applyDir(lang)
    set({ lang })
  },
  toggleLang: () => {
    const next: Lang = get().lang === 'fr' ? 'ar' : 'fr'
    applyDir(next)
    set({ lang: next })
  },
}))

export const useTranslation = () => {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const toggleLang = useLangStore((s) => s.toggleLang)
  const t = (key: TranslationKey): string => translations[lang][key] ?? translations.fr[key] ?? key
  const isRTL = lang === 'ar'
  return { t, lang, setLang, toggleLang, isRTL }
}
