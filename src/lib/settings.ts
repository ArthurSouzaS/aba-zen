import { DEFAULT_BLOCKLIST, parseBlocklist } from './blocking';
import { clampMinutes, DEFAULT_FOCUS_MINUTES } from './timer';

export interface Settings {
  /** Nome usado na saudação ("Bom dia, Arthur"). */
  name: string;
  /** Duração padrão da sessão de foco, em minutos. */
  focusMinutes: number;
  /** Domínios bloqueados durante o foco. */
  blocklist: string[];
  /** Registrar o tempo gasto em cada site (apenas localmente). */
  trackingEnabled: boolean;
  /** Mostrar a frase motivacional na nova aba. */
  showQuote: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  focusMinutes: DEFAULT_FOCUS_MINUTES,
  blocklist: [...DEFAULT_BLOCKLIST],
  trackingEnabled: true,
  showQuote: true,
};

/** Mescla o que veio do storage com os padrões, validando cada campo. */
export function normalizeSettings(value: unknown): Settings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    name: typeof v.name === 'string' ? v.name.trim().slice(0, 40) : DEFAULT_SETTINGS.name,
    focusMinutes:
      typeof v.focusMinutes === 'number' ? clampMinutes(v.focusMinutes) : DEFAULT_SETTINGS.focusMinutes,
    blocklist: Array.isArray(v.blocklist)
      ? parseBlocklist(v.blocklist.filter((x): x is string => typeof x === 'string')).domains
      : [...DEFAULT_SETTINGS.blocklist],
    trackingEnabled:
      typeof v.trackingEnabled === 'boolean' ? v.trackingEnabled : DEFAULT_SETTINGS.trackingEnabled,
    showQuote: typeof v.showQuote === 'boolean' ? v.showQuote : DEFAULT_SETTINGS.showQuote,
  };
}
